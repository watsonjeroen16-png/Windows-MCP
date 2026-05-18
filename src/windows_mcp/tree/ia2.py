"""IAccessible (MSAA / IA2) tree traversal for Firefox web DOM extraction.

Firefox exposes its browser chrome via UIA but its web DOM only via MSAA / IAccessible2.
The UIA traversal in :mod:`windows_mcp.tree.service` looks for an element with
``AutomationId == "RootWebArea"`` (the Chrome / Edge convention) to enter "DOM mode" —
Firefox has no such marker, so DOM extraction is skipped entirely.

This module fetches the root ``IAccessible`` from a Firefox window handle via
``AccessibleObjectFromWindow`` (oleacc.dll) and walks the resulting tree, collecting
text and interactive elements in the same shape used by the UIA path:

- ``dom_informative_nodes`` — list[TextElementNode]
- ``dom_interactive_nodes`` — list[TreeElementNode]
- ``dom_bounding_box`` — BoundingBox of the web content area
"""

from __future__ import annotations

import logging
from typing import Optional

from windows_mcp.tree.views import BoundingBox, TextElementNode, TreeElementNode

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# COM interface bootstrap (deferred — keeps the module importable on Linux for
# the pure-Python helpers below; the COM-touching code is only reached at
# runtime on Windows.)
# ---------------------------------------------------------------------------

_IAccessible = None
_COMError = None


def _iaccessible():
    """Lazily resolve the IAccessible interface class from oleacc.dll's type library."""
    global _IAccessible, _COMError
    if _IAccessible is None:
        import comtypes  # noqa: F401  (forces COM module init)
        import comtypes.client
        from _ctypes import COMError as _ComErrorCls

        comtypes.client.GetModule("oleacc.dll")
        from comtypes.gen.Accessibility import IAccessible  # type: ignore

        _IAccessible = IAccessible
        _COMError = _ComErrorCls
    return _IAccessible


class _UnavailableCOMError(Exception):
    """Sentinel exception type used when the real COMError isn't importable
    (i.e. when this module is being unit-tested on a non-Windows host).
    Catching this in ``except`` blocks is a no-op since no real call will ever
    raise it on that platform."""


def _com_error_cls():
    """Return the COMError class (lazy — only available on Windows)."""
    global _COMError
    if _COMError is None:
        try:
            from _ctypes import COMError as _ComErrorCls  # type: ignore
        except ImportError:
            _ComErrorCls = _UnavailableCOMError
        _COMError = _ComErrorCls
    return _COMError


# OBJID_CLIENT — request the client-area accessible object
OBJID_CLIENT = 0xFFFFFFFC

# CHILDID_SELF — refer to the element itself (vs. a simple child index)
CHILDID_SELF = 0


# ---------------------------------------------------------------------------
# MSAA role / state constants (oleacc.h)
# ---------------------------------------------------------------------------

ROLE_DOCUMENT = 0x0F
ROLE_GROUPING = 0x14
ROLE_TOOLBAR = 0x16
ROLE_STATUSBAR = 0x17
ROLE_TABLE = 0x18
ROLE_LINK = 0x1E
ROLE_LIST = 0x21
ROLE_LISTITEM = 0x22
ROLE_OUTLINE = 0x23
ROLE_OUTLINEITEM = 0x24
ROLE_PAGETAB = 0x25
ROLE_GRAPHIC = 0x28
ROLE_STATICTEXT = 0x29
ROLE_TEXT = 0x2A
ROLE_PUSHBUTTON = 0x2B
ROLE_CHECKBUTTON = 0x2C
ROLE_RADIOBUTTON = 0x2D
ROLE_COMBOBOX = 0x2E
ROLE_DROPLIST = 0x2F
ROLE_PROGRESSBAR = 0x30
ROLE_SLIDER = 0x33
ROLE_BUTTONDROPDOWN = 0x38
ROLE_PAGETABLIST = 0x3C
ROLE_SPLITBUTTON = 0x3E

STATE_SYSTEM_UNAVAILABLE = 0x00000001
STATE_SYSTEM_FOCUSED = 0x00000004
STATE_SYSTEM_INVISIBLE = 0x00008000
STATE_SYSTEM_OFFSCREEN = 0x00010000
STATE_SYSTEM_FOCUSABLE = 0x00100000
STATE_SYSTEM_LINKED = 0x00400000


ROLE_NAMES: dict[int, str] = {
    ROLE_DOCUMENT: "document",
    ROLE_GROUPING: "grouping",
    ROLE_TOOLBAR: "toolbar",
    ROLE_TABLE: "table",
    ROLE_LINK: "link",
    ROLE_LIST: "list",
    ROLE_LISTITEM: "list item",
    ROLE_OUTLINE: "outline",
    ROLE_OUTLINEITEM: "outline item",
    ROLE_PAGETAB: "tab",
    ROLE_GRAPHIC: "graphic",
    ROLE_STATICTEXT: "text",
    ROLE_TEXT: "text",
    ROLE_PUSHBUTTON: "button",
    ROLE_CHECKBUTTON: "check box",
    ROLE_RADIOBUTTON: "radio button",
    ROLE_COMBOBOX: "combo box",
    ROLE_DROPLIST: "drop list",
    ROLE_SLIDER: "slider",
    ROLE_BUTTONDROPDOWN: "button",
    ROLE_PAGETABLIST: "tab list",
    ROLE_SPLITBUTTON: "button",
}

INTERACTIVE_ROLES: set[int] = {
    ROLE_LINK,
    ROLE_PUSHBUTTON,
    ROLE_CHECKBUTTON,
    ROLE_RADIOBUTTON,
    ROLE_COMBOBOX,
    ROLE_DROPLIST,
    ROLE_SLIDER,
    ROLE_LISTITEM,
    ROLE_OUTLINEITEM,
    ROLE_PAGETAB,
    ROLE_BUTTONDROPDOWN,
    ROLE_SPLITBUTTON,
}

INFORMATIVE_ROLES: set[int] = {
    ROLE_STATICTEXT,
    ROLE_TEXT,
}

# Walk caps — Firefox's a11y tree can be huge on heavy pages.
# Caps apply to the active document subtree; chrome and inactive tabs are pruned first.
MAX_DEPTH = 500
MAX_NODES = 30000


def role_name(role: object) -> str:
    """Map an accRole result (int or BSTR) to a friendly control-type name."""
    if isinstance(role, str):
        return role.strip().lower() or "unknown"
    if isinstance(role, int):
        return ROLE_NAMES.get(role, "unknown")
    return "unknown"


# ---------------------------------------------------------------------------
# IAccessible acquisition
# ---------------------------------------------------------------------------


def _accessible_object_from_window(hwnd: int):
    """Wrap oleacc!AccessibleObjectFromWindow and return a comtypes IAccessible pointer."""
    import ctypes
    from ctypes import wintypes

    from comtypes import GUID  # noqa: F401  (re-exported for type clarity)

    iface = _iaccessible()
    oleacc = ctypes.windll.oleacc

    oleacc.AccessibleObjectFromWindow.argtypes = [
        wintypes.HWND,
        wintypes.DWORD,
        ctypes.POINTER(GUID),
        ctypes.POINTER(ctypes.POINTER(iface)),
    ]
    oleacc.AccessibleObjectFromWindow.restype = ctypes.HRESULT

    pacc = ctypes.POINTER(iface)()
    hr = oleacc.AccessibleObjectFromWindow(
        hwnd,
        OBJID_CLIENT,
        ctypes.byref(iface._iid_),
        ctypes.byref(pacc),
    )
    if hr != 0:
        raise OSError(f"AccessibleObjectFromWindow failed: HRESULT=0x{hr & 0xFFFFFFFF:08X}")
    if not pacc:
        raise RuntimeError("AccessibleObjectFromWindow returned a null pointer")
    return pacc


# ---------------------------------------------------------------------------
# Property accessors — every IAccessible call can throw COMError; isolate them.
# ---------------------------------------------------------------------------


def _acc_role(iacc) -> object:
    COMError = _com_error_cls()
    try:
        return iacc.accRole(CHILDID_SELF)
    except COMError:
        return -1


def _acc_state(iacc) -> int:
    COMError = _com_error_cls()
    try:
        state = iacc.accState(CHILDID_SELF)
        return int(state) if isinstance(state, int) else 0
    except COMError:
        return 0
    except (TypeError, ValueError):
        return 0


def _acc_name(iacc) -> str:
    COMError = _com_error_cls()
    try:
        name = iacc.accName(CHILDID_SELF)
        return (name or "").strip()
    except COMError:
        return ""


def _acc_value(iacc) -> str:
    COMError = _com_error_cls()
    try:
        value = iacc.accValue(CHILDID_SELF)
        return (value or "").strip()
    except COMError:
        return ""


def _acc_location(iacc) -> Optional[tuple[int, int, int, int]]:
    """Return (left, top, width, height) for the element, or None on failure."""
    COMError = _com_error_cls()
    try:
        # accLocation has out-params; comtypes returns a tuple.
        left, top, width, height = iacc.accLocation(CHILDID_SELF)
        return int(left), int(top), int(width), int(height)
    except COMError:
        return None
    except (TypeError, ValueError):
        return None


def _acc_child_count(iacc) -> int:
    COMError = _com_error_cls()
    try:
        return int(iacc.accChildCount)
    except (COMError, TypeError, ValueError):
        return 0


def _iter_children(iacc, iface):
    """Yield IAccessible children. Skips simple-child entries (no IDispatch)."""
    COMError = _com_error_cls()
    count = _acc_child_count(iacc)
    if count <= 0:
        return
    for index in range(1, count + 1):
        try:
            disp = iacc.accChild(index)
        except COMError:
            continue
        if disp is None:
            continue
        try:
            child = disp.QueryInterface(iface)
        except (COMError, AttributeError):
            continue
        yield child


# ---------------------------------------------------------------------------
# Traversal
# ---------------------------------------------------------------------------


def _bounding_box_from_location(
    location: tuple[int, int, int, int], clip: Optional[BoundingBox]
) -> BoundingBox:
    left, top, width, height = location
    right, bottom = left + width, top + height
    if clip is not None:
        left = max(left, clip.left)
        top = max(top, clip.top)
        right = min(right, clip.right)
        bottom = min(bottom, clip.bottom)
    width = max(0, right - left)
    height = max(0, bottom - top)
    return BoundingBox(left=left, top=top, right=right, bottom=bottom, width=width, height=height)


def _is_visible(state: int, location: Optional[tuple[int, int, int, int]]) -> bool:
    if state & (STATE_SYSTEM_INVISIBLE | STATE_SYSTEM_OFFSCREEN):
        return False
    if location is None:
        return False
    _, _, width, height = location
    return width > 0 and height > 0


class _Walker:
    """Encapsulates traversal state (caps, counts, output buffers).

    Scoping rules:
    1. Invisible / offscreen subtrees are pruned entirely (don't descend). This is
       what filters out Firefox's inactive tabs — their document subtrees are marked
       invisible.
    2. Content is only recorded while inside a ROLE_DOCUMENT subtree. This filters
       out Firefox chrome (toolbar, tab strip, URL bar, bookmarks) which would
       otherwise dominate the output.
    3. The first visible document we enter sets ``active_document_box`` — used by
       ``traverse_window`` as the DOM bounding box.
    """

    def __init__(self, window_name: str, dom_clip: Optional[BoundingBox]):
        self.window_name = window_name
        self.dom_clip = dom_clip
        self.informative: list[TextElementNode] = []
        self.interactive: list[TreeElementNode] = []
        self.seen = 0
        self.in_document = 0  # depth of nested documents (iframes etc.)
        self.active_document_box: Optional[BoundingBox] = None

    def walk(self, iacc, iface, depth: int = 0) -> None:
        if depth > MAX_DEPTH or self.seen >= MAX_NODES:
            return
        self.seen += 1

        role = _acc_role(iacc)
        state = _acc_state(iacc)
        location = _acc_location(iacc)

        # Prune entire invisible subtrees. Always descend from the root (depth==0)
        # because the window root itself may report an unusual bbox.
        if depth > 0 and not _is_visible(state, location):
            return

        role_int = role if isinstance(role, int) else -1
        is_document = role_int == ROLE_DOCUMENT
        if is_document:
            self.in_document += 1
            if self.active_document_box is None and location is not None:
                self.active_document_box = _bounding_box_from_location(location, self.dom_clip)

        # Only record content while we're inside (or at the root of) a document subtree.
        if self.in_document > 0 and _is_visible(state, location):
            self._record(iacc, role, state, location)

        COMError = _com_error_cls()
        for child in _iter_children(iacc, iface):
            try:
                self.walk(child, iface, depth + 1)
            except COMError as e:
                logger.debug("Skipping IA2 subtree due to COMError: %s", e)
                continue

        if is_document:
            self.in_document -= 1

    def _record(
        self,
        iacc,
        role: object,
        state: int,
        location: Optional[tuple[int, int, int, int]],
    ) -> None:
        if location is None:
            return

        role_int = role if isinstance(role, int) else -1
        role_label = role_name(role)
        name = _acc_name(iacc)

        if role_int in INFORMATIVE_ROLES:
            if name:
                self.informative.append(TextElementNode(text=name))
            return

        if role_int in INTERACTIVE_ROLES or (state & STATE_SYSTEM_LINKED):
            bbox = _bounding_box_from_location(location, self.dom_clip)
            if bbox.width <= 0 or bbox.height <= 0:
                return
            center = bbox.get_center()
            metadata: dict[str, object] = {}
            if state & STATE_SYSTEM_FOCUSED:
                metadata["has_focused"] = True
            if not (state & STATE_SYSTEM_FOCUSED):
                metadata.setdefault("has_focused", False)
            value = _acc_value(iacc)
            if value and role_int == ROLE_LINK:
                metadata["url"] = value
            elif value and role_int in {ROLE_COMBOBOX, ROLE_DROPLIST, ROLE_SLIDER}:
                metadata["value"] = value
            display_name = name or value or role_label
            self.interactive.append(
                TreeElementNode(
                    name=display_name,
                    control_type=role_label.title() or "Unknown",
                    bounding_box=bbox,
                    center=center,
                    window_name=self.window_name,
                    metadata=metadata,
                )
            )
            return

        # ROLE_GRAPHIC with a non-empty alt text — surface as informative text.
        if role_int == ROLE_GRAPHIC and name:
            self.informative.append(TextElementNode(text=name))


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


class IA2TraversalResult:
    """Output of :func:`traverse_window`."""

    __slots__ = ("dom_bounding_box", "informative_nodes", "interactive_nodes")

    def __init__(
        self,
        dom_bounding_box: Optional[BoundingBox],
        informative_nodes: list[TextElementNode],
        interactive_nodes: list[TreeElementNode],
    ):
        self.dom_bounding_box = dom_bounding_box
        self.informative_nodes = informative_nodes
        self.interactive_nodes = interactive_nodes

    def __bool__(self) -> bool:
        return bool(self.informative_nodes or self.interactive_nodes)


def traverse_window(
    hwnd: int,
    window_name: str,
    window_bounding_box: Optional[BoundingBox] = None,
) -> IA2TraversalResult:
    """Walk the IAccessible tree of *hwnd* and return DOM-shaped node lists.

    ``window_bounding_box`` is used to clip element rectangles to the window's
    visible area, matching what the UIA path does via :py:meth:`Tree.iou_bounding_box`.
    """
    iface = _iaccessible()
    try:
        root = _accessible_object_from_window(hwnd)
    except (OSError, RuntimeError) as e:
        logger.warning("IA2 acquisition failed for hwnd %#x: %s", hwnd, e)
        return IA2TraversalResult(window_bounding_box, [], [])

    walker = _Walker(window_name=window_name, dom_clip=window_bounding_box)
    COMError = _com_error_cls()
    try:
        walker.walk(root, iface)
    except COMError as e:
        logger.warning("IA2 walk for hwnd %#x aborted with COMError: %s", hwnd, e)

    # Prefer the active document's bbox (the web content area) over the window bbox.
    # Falls back to the window bbox if no document was found in the tree.
    dom_bbox = walker.active_document_box or window_bounding_box

    return IA2TraversalResult(
        dom_bounding_box=dom_bbox,
        informative_nodes=walker.informative,
        interactive_nodes=walker.interactive,
    )

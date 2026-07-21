import { isUiToPluginMessage, type PluginToUiMessage } from "./messages";

figma.showUI(__html__, {
  width: 420,
  height: 620,
  themeColors: true
});

const MAX_SVG_LENGTH = 1_500_000;
const INSERTED_LOGO_KEY = "awalogo:inserted";
type ClipShapeNode = RectangleNode | EllipseNode | PolygonNode | StarNode | VectorNode | BooleanOperationNode;
type InsertedLogoNode = RectangleNode | FrameNode;

const CLIP_SHAPE_TYPES = new Set<SceneNode["type"]>([
  "RECTANGLE",
  "ELLIPSE",
  "POLYGON",
  "STAR",
  "VECTOR",
  "BOOLEAN_OPERATION"
]);

function postToUi(message: PluginToUiMessage) {
  figma.ui.postMessage(message);
}

function placeNode(node: SceneNode) {
  node.x = figma.viewport.center.x - node.width / 2;
  node.y = figma.viewport.center.y - node.height / 2;
  figma.currentPage.appendChild(node);
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
}

function selectedClipShape(): ClipShapeNode | null {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) return null;
  const node = selection[0];
  return CLIP_SHAPE_TYPES.has(node.type) && !node.locked ? node as ClipShapeNode : null;
}

function selectedFrame(): FrameNode | null {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) return null;
  const node = selection[0];
  return node.type === "FRAME" && !node.locked ? node : null;
}

function selectedInsertedLogo(): InsertedLogoNode | null {
  const selection = figma.currentPage.selection;
  if (selection.length !== 1) return null;
  const node = selection[0];
  if (node.type !== "RECTANGLE" && node.type !== "FRAME") return null;
  const isTagged = node.getPluginData(INSERTED_LOGO_KEY) === "true";
  const isLegacyPluginLogo = node.name.endsWith(" logo") && !node.name.includes(" · ");
  return isTagged || isLegacyPluginLogo ? node : null;
}

function markInsertedLogo(node: InsertedLogoNode) {
  node.setPluginData(INSERTED_LOGO_KEY, "true");
}

function replaceInsertedLogo(previous: InsertedLogoNode, replacement: InsertedLogoNode) {
  const parent = previous.parent;
  if (!parent || !("children" in parent)) return false;

  const index = parent.children.indexOf(previous);
  const geometry = {
    x: previous.x,
    y: previous.y,
    width: previous.width,
    height: previous.height,
    rotation: previous.rotation,
    constraints: previous.constraints,
    layoutPositioning: previous.layoutPositioning,
    layoutAlign: previous.layoutAlign,
    layoutGrow: previous.layoutGrow
  };

  parent.insertChild(index, replacement);
  replacement.resize(geometry.width, geometry.height);
  replacement.rotation = geometry.rotation;
  replacement.constraints = geometry.constraints;
  replacement.layoutPositioning = geometry.layoutPositioning;
  replacement.layoutAlign = geometry.layoutAlign;
  replacement.layoutGrow = geometry.layoutGrow;
  if (geometry.layoutPositioning === "ABSOLUTE" || !(parent.type === "FRAME" && parent.layoutMode !== "NONE")) {
    replacement.x = geometry.x;
    replacement.y = geometry.y;
  }
  markInsertedLogo(replacement);
  previous.remove();
  figma.currentPage.selection = [replacement];
  figma.viewport.scrollAndZoomIntoView([replacement]);
  return true;
}

function placeNodeInFrame(node: FrameNode | RectangleNode, frame: FrameNode) {
  frame.appendChild(node);
  if (frame.layoutMode !== "NONE") node.layoutPositioning = "ABSOLUTE";
  node.x = (frame.width - node.width) / 2;
  node.y = (frame.height - node.height) / 2;
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
}

function clippedToRaster(shape: ClipShapeNode, image: Image, name: string) {
  shape.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
  shape.name = `${shape.name} · ${name} logo`;
  figma.currentPage.selection = [shape];
  figma.viewport.scrollAndZoomIntoView([shape]);
}

function clippedToVector(shape: ClipShapeNode, logo: FrameNode, name: string): GroupNode | null {
  const parent = shape.parent;
  if (!parent || !(parent.type === "PAGE" || parent.type === "FRAME" || parent.type === "GROUP" || parent.type === "SECTION")) {
    return null;
  }

  const index = parent.children.indexOf(shape);
  parent.appendChild(logo);
  const scale = Math.max(shape.width / logo.width, shape.height / logo.height);
  logo.resize(Math.max(1, logo.width * scale), Math.max(1, logo.height * scale));
  logo.x = shape.x + (shape.width - logo.width) / 2;
  logo.y = shape.y + (shape.height - logo.height) / 2;

  const group = figma.group([shape, logo], parent, index);
  shape.isMask = true;
  shape.maskType = "ALPHA";
  group.name = `${name} clipped logo`;
  figma.currentPage.selection = [group];
  figma.viewport.scrollAndZoomIntoView([group]);
  return group;
}

figma.ui.onmessage = async (message: unknown) => {
  if (!isUiToPluginMessage(message)) return;

  if (message.type === "close") {
    figma.closePlugin();
    return;
  }

  if (message.type === "insert-image") {
    try {
      const image = figma.createImage(new Uint8Array(message.bytes));
      const replacementTarget = selectedInsertedLogo();
      if (replacementTarget) {
        const node = figma.createRectangle();
        node.name = `${message.name} logo`;
        node.resize(message.width, message.height);
        node.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FIT" }];
        if (replaceInsertedLogo(replacementTarget, node)) {
          figma.notify(`Selected logo replaced with ${message.name}`, { timeout: 1800 });
          postToUi({ type: "replaced", name: message.name });
          return;
        }
      }
      const insertionFrame = selectedFrame();
      if (insertionFrame) {
        const node = figma.createRectangle();
        node.name = `${message.name} logo`;
        node.resize(message.width, message.height);
        node.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FIT" }];
        markInsertedLogo(node);
        placeNodeInFrame(node, insertionFrame);
        figma.notify(`${message.name} inserted into selected frame`, { timeout: 1800 });
        postToUi({ type: "inserted-in-frame", name: message.name });
        return;
      }
      const clipShape = selectedClipShape();
      if (clipShape) {
        clippedToRaster(clipShape, image, message.name);
        figma.notify(`${message.name} clipped to selected shape`, { timeout: 1800 });
        postToUi({ type: "clipped", name: message.name });
        return;
      }
      const node = figma.createRectangle();
      node.name = `${message.name} logo`;
      node.resize(message.width, message.height);
      node.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FIT" }];
      markInsertedLogo(node);
      placeNode(node);
      figma.notify(`${message.name} inserted`, { timeout: 1800 });
      postToUi({ type: "inserted", name: message.name });
    } catch (error) {
      postToUi({
        type: "error",
        message: error instanceof Error ? error.message : "Could not insert this image."
      });
    }
    return;
  }

  if (!message.svg.trim().startsWith("<svg") || message.svg.length > MAX_SVG_LENGTH) {
    postToUi({ type: "error", message: "This SVG is invalid or too large to insert." });
    return;
  }

  try {
    const replacementTarget = selectedInsertedLogo();
    const insertionFrame = selectedFrame();
    const clipShape = selectedClipShape();
    const node = figma.createNodeFromSvg(message.svg);
    node.name = `${message.name} logo`;
    node.resize(message.width, message.height);
    if (replacementTarget && replaceInsertedLogo(replacementTarget, node)) {
      figma.notify(`Selected logo replaced with ${message.name}`, { timeout: 1800 });
      postToUi({ type: "replaced", name: message.name });
      return;
    }
    if (insertionFrame) {
      markInsertedLogo(node);
      placeNodeInFrame(node, insertionFrame);
      figma.notify(`${message.name} inserted into selected frame`, { timeout: 1800 });
      postToUi({ type: "inserted-in-frame", name: message.name });
      return;
    }
    if (clipShape && clippedToVector(clipShape, node, message.name)) {
      figma.notify(`${message.name} clipped to selected shape`, { timeout: 1800 });
      postToUi({ type: "clipped", name: message.name });
      return;
    }
    markInsertedLogo(node);
    placeNode(node);

    figma.notify(`${message.name} inserted`, { timeout: 1800 });
    postToUi({ type: "inserted", name: message.name });
  } catch (error) {
    postToUi({
      type: "error",
      message: error instanceof Error ? error.message : "Could not insert this SVG."
    });
  }
};

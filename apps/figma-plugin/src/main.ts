figma.showUI(__html__, {
  width: 420,
  height: 620,
  themeColors: true
});

figma.ui.onmessage = async (message: { type: string; name?: string; svg?: string }) => {
  if (message.type === "close") {
    figma.closePlugin();
    return;
  }

  if (message.type !== "insert-logo" || !message.svg || !message.name) {
    return;
  }

  try {
    const node = figma.createNodeFromSvg(message.svg);
    node.name = `${message.name} logo`;
    node.x = figma.viewport.center.x - node.width / 2;
    node.y = figma.viewport.center.y - node.height / 2;

    figma.currentPage.appendChild(node);
    figma.currentPage.selection = [node];
    figma.viewport.scrollAndZoomIntoView([node]);

    figma.ui.postMessage({ type: "inserted", name: message.name });
  } catch (error) {
    figma.ui.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Could not insert this SVG."
    });
  }
};

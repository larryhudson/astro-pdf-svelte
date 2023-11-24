<script>
  import { onMount } from "svelte";
  import { writable } from "svelte/store";
  export let workerUrl;

  let pdfDoc = null;
  let currentPage = 1;
  let numPages = 0;
  let scale = 1;
  const paragraphs = writable([]);
  let canvas;
  let file;
  let dragging = false;
  let startX, startY;
  let selectedParagraph = null;
  let translateX = 0,
    translateY = 0;
  let isReadyToOrder = false;
  let isOrdering = false;

  let hoverTimeout;
  let currentOrderIndex = 1;

  onMount(() => {
    // Initial setup if needed
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  });

  function handleFileChange(event) {
    file = event.target.files[0];
    if (file) {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        const typedArray = new Uint8Array(e.target.result);
        window.pdfjsLib
          .getDocument({ data: typedArray })
          .promise.then((loadedPdf) => {
            pdfDoc = loadedPdf;
            numPages = pdfDoc.numPages;
            // Render the first page or others as needed
            renderPdfPage();
          });
      };
      fileReader.readAsArrayBuffer(file);
    }
  }

  async function renderPdfPage() {
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale });
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    page.render(renderContext);
  }

  function startPan(event) {
    dragging = true;
    startX = event.clientX - translateX;
    startY = event.clientY - translateY;
  }

  function doPan(event) {
    if (dragging) {
      translateX = event.clientX - startX;
      translateY = event.clientY - startY;
    }
  }

  function endPan() {
    dragging = false;
  }

  function startPanOrOrder(event) {
    if (isReadyToOrder) {
      startOrder();
    } else {
      startPan(event);
    }
  }

  function doPanOrOrder(event) {
    if (isReadyToOrder) {
      // doOrder(event);
    } else {
      doPan(event);
    }
  }

  function endPanOrOrder() {
    if (isReadyToOrder) {
      endOrder();
    } else {
      endPan();
    }
  }

  $: if (scale !== 1) {
    renderPdfPage();
  }

  const zoomIn = () => (scale *= 1.2);
  const zoomOut = () => (scale /= 1.2);

  function nextPage() {
    if (currentPage < numPages) {
      currentPage++;
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
    }
  }

  function handleWheel(event) {
    event.preventDefault();
    const zoomSensitivity = 0.1;
    if (event.deltaY < 0) {
      scale *= 1 + zoomSensitivity;
    } else {
      scale /= 1 + zoomSensitivity;
    }
  }

  function startOrder() {
    isOrdering = true;
    paragraphs.update((ps) => ps.map((p) => ({ ...p, ordered: false })));
  }

  function endOrder() {
    isOrdering = false;
    currentOrderIndex = 1;
    console.log({ $paragraphs });
  }

  function handleHover(paragraph) {
    if (!isOrdering) return;
    hoverTimeout = setTimeout(() => orderParagraph(paragraph), 200);
  }

  function orderParagraph(paragraph) {
    paragraphs.update((ps) => {
      const updatedParagraphs = ps.map((p) => {
        if (p.id === paragraph.id && !p.ordered) {
          return { ...p, order: currentOrderIndex++, ordered: true };
        }
        return p;
      });
      return updatedParagraphs.sort((a, b) => a.order - b.order);
    });
  }

  function transformParagraphData(paragraphs) {
    return paragraphs.map((paragraph, pIndex) => {
      const boundingBox = paragraph.boundingRegions[0].polygon;
      const topLeft = boundingBox[0];
      const bottomRight = boundingBox[2];

      return {
        x: topLeft.x * 72,
        y: topLeft.y * 72,
        width: (bottomRight.x - topLeft.x) * 72,
        height: (bottomRight.y - topLeft.y) * 72,
        content: paragraph.content,
        id: pIndex,
      };
    });
  }

  function setParagraphTag(tag) {
    // const paragraph = paragraphs.find((p) => p.id === selectedParagraph);
    // paragraph.tag = tag;
    //
    // console.log({ paragraphs });
  }

  async function extractContent() {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("page", currentPage);

    const response = await fetch("/api/extract-pdf-content", {
      body: formData,
      method: "POST",
    });

    const responseJson = await response.json();
    const paragraphCoords = transformParagraphData(responseJson.paragraphs);
    paragraphs.set(
      paragraphCoords.map((p, index) => ({ ...p, order: index + 1 })),
    );
  }

  $: currentPage, renderPdfPage(); // Re-render when currentPage changes
</script>

<label for="file-input">Upload your PDF here</label>
<input
  type="file"
  id="file-input"
  accept="application/pdf"
  on:change={handleFileChange}
/>

<p>Zoom: {Math.floor(scale * 100)}%</p>
<button on:click={zoomIn}>Zoom In</button>
<button on:click={zoomOut}>Zoom Out</button>

<div class="toolbar">
  <button
    on:click={() => {
      isReadyToOrder = !isReadyToOrder;
    }}>{isReadyToOrder ? "Stop ordering" : "Set order"}</button
  >
  <button on:click={() => setParagraphTag("h1")} disabled={!selectedParagraph}
    >H1</button
  >
  <button on:click={() => setParagraphTag("h2")} disabled={!selectedParagraph}
    >H2</button
  >
</div>

<div
  class="pdf-container"
  on:mousedown={startPanOrOrder}
  on:mousemove={doPanOrOrder}
  on:mouseup={endPanOrOrder}
  on:wheel={handleWheel}
  on:click={() => (selectedParagraph = null)}
  class:dragging
>
  <canvas
    bind:this={canvas}
    style="transform: translate({translateX}px, {translateY}px);"
  ></canvas>

  {#each $paragraphs as coord (coord.id)}
    <button
      on:click={(event) => {
        selectedParagraph = coord.id;
        event.stopPropagation();
      }}
      on:mouseover={() => handleHover(coord)}
      class:selected={selectedParagraph === coord.id}
      class="interactive-box button-reset"
      style="left: {coord.x * scale + translateX}px; top: {coord.y * scale +
        translateY}px; width: {coord.width * scale}px; height: {coord.height *
        scale}px;"
    >
      {isReadyToOrder && coord.order}
    </button>
  {/each}
</div>

<button on:click={prevPage} disabled={currentPage <= 1}>Previous Page</button>
<button on:click={nextPage} disabled={currentPage >= numPages}>Next Page</button
>
<button on:click={extractContent}>Extract Content</button>

<style>
  .pdf-container {
    width: 100%;
    height: 90vh; /* Adjust the height as needed */
    position: relative;
    overflow: hidden; /* This will clip the overflow */
    border: 2px solid black;
  }

  .pdf-container.dragging {
    cursor: grabbing;
  }

  canvas {
    position: absolute;
    top: 0;
    left: 0;
  }

  .button-reset {
    all: unset;
    border: 2px solid black;
    cursor: pointer;
  }

  .interactive-box {
    position: absolute;
    background-color: rgba(255, 255, 0, 0.5);
  }

  .interactive-box.selected {
    border: 4px solid blue;
    background-color: rgba(0, 0, 255, 0.5);
  }
</style>

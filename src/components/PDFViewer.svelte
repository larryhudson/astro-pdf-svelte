<script>
  import { onMount } from "svelte";
  export let workerUrl;

  let pdfDoc = null;
  let currentPage = 1;
  let numPages = 0;
  let scale = 1;
  let paragraphCoords = []; // Populate this with your paragraph coordinates
  let canvas;
  let file;
  let dragging = false;
  let startX, startY;
  let translateX = 0,
    translateY = 0;

  onMount(() => {
    // Initial setup if needed
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  });

  function handleFileChange(event) {
    const file = event.target.files[0];
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

  function startDrag(event) {
    dragging = true;
    startX = event.clientX - translateX;
    startY = event.clientY - translateY;
  }

  function doDrag(event) {
    if (dragging) {
      translateX = event.clientX - startX;
      translateY = event.clientY - startY;
    }
  }

  function endDrag() {
    dragging = false;
  }

  $: if (scale !== 1) {
    renderPdfPage(); // Re-render when scale changes
  }

  const zoomIn = () => (scale *= 1.2);
  const zoomOut = () => (scale /= 1.2);

  function nextPage() {
    if (currentPage < numPages) {
      currentPage++;
      // Optionally, update paragraphCoords for the new page
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      currentPage--;
      // Optionally, update paragraphCoords for the new page
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

  $: currentPage, renderPdfPage(); // Re-render when currentPage changes
</script>

<label for="file-input">Upload your PDF here</label>
<input
  type="file"
  id="file-input"
  accept="application/pdf"
  on:change={handleFileChange}
/>

<div
  class="pdf-container"
  on:mousedown={startDrag}
  on:mousemove={doDrag}
  on:mouseup={endDrag}
  on:wheel={handleWheel}
  class:dragging
>
  <canvas
    bind:this={canvas}
    style="transform: translate({translateX}px, {translateY}px);"
  ></canvas>

  {#each paragraphCoords as coord (coord.id)}
    <div
      class="interactive-box"
      style="left: {coord.x * scale}px; top: {coord.y *
        scale}px; transform: scale({scale});"
    ></div>
  {/each}
</div>

<button on:click={zoomIn}>Zoom In</button>
<button on:click={zoomOut}>Zoom Out</button>
<button on:click={prevPage} disabled={currentPage <= 1}>Previous Page</button>
<button on:click={nextPage} disabled={currentPage >= numPages}>Next Page</button
>

<style>
  .pdf-container {
    width: 800px; /* Adjust the width as needed */
    height: 600px; /* Adjust the height as needed */
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

  .interactive-box {
    position: absolute;
    /* additional styling */
  }
</style>

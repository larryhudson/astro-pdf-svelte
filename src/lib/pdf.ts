import {
  AzureKeyCredential,
  DocumentAnalysisClient,
} from "@azure/ai-form-recognizer";

// this was in Microsoft's code sample and might be useful later
function* getTextOfSpans(content, spans) {
  for (const span of spans) {
    yield content.slice(span.offset, span.offset + span.length);
  }
}

export async function getContentFromPdf(pdfFile: File, pageNumber: number) {
  const AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = import.meta.env
    .AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const AZURE_DOCUMENT_INTELLIGENCE_KEY = import.meta.env
    .AZURE_DOCUMENT_INTELLIGENCE_KEY;
  // create your `DocumentAnalysisClient` instance and `AzureKeyCredential` variable
  const client = new DocumentAnalysisClient(
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
    new AzureKeyCredential(AZURE_DOCUMENT_INTELLIGENCE_KEY),
  );

  const fileArrayBuffer = await pdfFile.arrayBuffer();
  const poller = await client.beginAnalyzeDocument(
    "prebuilt-read",
    fileArrayBuffer,
    {
      pages: pageNumber.toString(),
    },
  );

  const result = await poller.pollUntilDone();

  return result;
}

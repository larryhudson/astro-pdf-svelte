import { getContentFromPdf } from "@src/lib/pdf";

export const POST = async function (context) {
  const formData = await context.request.formData();
  const file = formData.get("file");
  const pageNumber = formData.get("page");

  console.log(file);
  console.log(pageNumber);

  const pdfData = await getContentFromPdf(file, pageNumber);

  return new Response(JSON.stringify(pdfData), {
    headers: { "content-type": "application/json" },
  });
};

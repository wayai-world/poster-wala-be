const emailTemplates = require("./emailTemplates.json");
const WEBHOOK_URL_FOR_EMAIL = process.env.WEBHOOK_URL_FOR_EMAIL;

// Build email HTML from template
function buildEmailHtml(template, data) {
  let htmlContent = template["html-content"];

  for (const key in data) {
    const regex = new RegExp(`<${key}>`, "g");
    htmlContent = htmlContent.replace(regex, data[key] || "");
  }
  return htmlContent;
}

// Send email with fetch
async function sendEmail(to, subject, htmlContent) {
  try {
    const response = await fetch(WEBHOOK_URL_FOR_EMAIL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, htmlContent }),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Email sent successfully:", to);
    return data;
  } catch (error) {
    console.log("err", error);
    console.error("❌ Failed to send email:", error.message);
    throw error;
  }
}

/* -----------------------------------------
    SEND ANY TEMPLATE BY NAME
------------------------------------------- */
// async function sendTemplateEmail(templateName, data) {
//   console.log("Creating user", data);
//   const template = emailTemplates.find((t) => t.name === templateName);

//   if (!template) {
//     throw new Error(`Email template not found: ${templateName}`);
//   }

//   const html = buildEmailHtml(template, data);

//   return await sendEmail(data.userEmail || data.to, template.subject, html);
// }

async function sendTemplateEmail(templateName, data) {
  const template = emailTemplates.find((t) => t.name === templateName);
  if (!template) throw new Error(`Email template not found: ${templateName}`);

  // replace placeholders in subject
  let subject = template.subject;
  for (const key in data) {
    const regex = new RegExp(`<${key}>`, "g");
    subject = subject.replace(regex, data[key] || "");
  }

  const html = buildEmailHtml(template, data);

  return await sendEmail(data.userEmail || data.to, subject, html);
}

module.exports = {
  buildEmailHtml,
  sendEmail,
  sendTemplateEmail,
};

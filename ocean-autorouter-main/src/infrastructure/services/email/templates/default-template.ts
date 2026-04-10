export const defaultEmailTemplate = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SnowDog Autorouter</title>
    <style>
      body {
        font-family: sans-serif;
        background-color: #f4f4f4;
        color: #333;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #fff;
        padding: 20px;
        border-radius: 5px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      }
      .header {
        text-align: center;
        margin-bottom: 20px;
      }
      .header img {
        max-width: 100px;
      }
      .content {
        line-height: 1.6;
      }
      .referral-link {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #eee;
        text-align: center;
      }
      .referral-link a {
        color: #0066cc;
        text-decoration: none;
        font-weight: 500;
      }
      .referral-link a:hover {
        text-decoration: underline;
      }
      .footer {
        margin-top: 20px;
        text-align: center;
        font-size: 0.8em;
        color: #666;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="{{logoUrl}}" alt="SnowDog Autorouter Logo" />
      </div>
      <div class="content">{{{message}}}</div>
      {{#if referralLink}}
      <div class="referral-link">
        <a href="{{referralLink}}" target="_blank">View in Ocean</a>
      </div>
      {{/if}}
      <div class="footer">
        <p>This is an automated message from SnowDog Autorouter.</p>
      </div>
    </div>
  </body>
</html>
`;

import nodemailer from 'nodemailer';

export class EmailService {
  transporter;
  fromEmail;
  toEmail;
  subject;

  constructor(service: string, fromEmail: string, password: string, toEmail: string, subject: string) {
    console.log(`Initializing email service with service: ${service}, from: ${fromEmail}, to: ${toEmail}`);
    this.transporter = nodemailer.createTransport({
      service,
      auth: {
        user: fromEmail,
        pass: password
      }
    });
    this.fromEmail = fromEmail;
    this.toEmail = toEmail;
    this.subject = subject;
  }

  async sendPhotoEmail(photos: any[], hostIp: string, port: string): Promise<void> {
    if (photos.length === 0) {
      console.log('No photos to send.');
      return;
    }
    console.log(`Preparing to send email with ${photos.length} photos.`);
    console.log('Host IP:', hostIp);
    console.log('Port:', port);
    const totalPhotos = photos.length;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="color: #2c3e50;">Emlékek erről a napról...</h2>
        <p>
          Az elmúlt években a mai napon ${totalPhotos} fotó készült.<br><br>
          A fotókat a lenti gomb megnyomásával tekintheted meg.<br><br>
        </p>
        <div style="text-align: center; margin-top: 20px;">
          <a href="http://192-168-1-111.joshytheface.direct.quickconnect.to:9999/"
             style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;"
             target="_blank">
            Fotók megtekintése
          </a>
        </div>
      </div>
    `;
    const mailOptions = {
      from: this.fromEmail,
      to: this.toEmail,
      subject: this.subject,
      html: htmlContent
    };
    try {
      console.log('Attempting to send email with options:', {
        from: this.fromEmail,
        to: this.toEmail,
        subject: this.subject,
        numberOfPhotos: photos.length
      });
      const verifyResult = await this.transporter.verify();
      console.log('SMTP connection verified:', verifyResult);
      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected
      });
    } catch (error) {
      console.error('Error sending email:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      throw error;
    }
  }
}

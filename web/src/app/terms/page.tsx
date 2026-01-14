import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Terms of Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-muted-foreground">
          <p><strong>Last Updated:</strong> November 10, 2025</p>

          <p>
            Please read these Terms of Service (&quot;Terms&quot;) carefully before using the CereBro Discord bot and associated web services (the &quot;Service&quot;). Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms.
          </p>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">2. Description of Service</h2>
            <p>
              CereBro is a Discord bot and web application designed for the Marvel Contest of Champions (MCOC) community. It provides tools for managing champion rosters, tracking prestige, and creating a community-driven database of Alliance War videos.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">3. User Conduct and Responsibilities</h2>
            <p>
              You are solely responsible for the content you submit to the Service. By uploading a video, you affirm that:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>You have the necessary rights and permissions to the content you are uploading.</li>
              <li>The content does not infringe on the copyrights, trademarks, or other intellectual property rights of any third party.</li>
              <li>The content adheres to the terms of service of both Discord and YouTube.</li>
              <li>You will not submit content that is hateful, defamatory, obscene, or otherwise objectionable.</li>
            </ul>
            <p>
              We reserve the right to remove any content and/or suspend user access to the upload feature for violations of these terms.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">4. Video Uploads and YouTube</h2>
            <p>
              The Service uses the YouTube Data API to upload videos to a designated YouTube channel. By using the video upload feature, you agree to be bound by the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">YouTube Terms of Service</a>.
            </p>
            <p>
              We are not responsible for any issues, content strikes, or account actions taken by YouTube. Videos are uploaded as &quot;unlisted&quot; by default unless you specify otherwise, meaning they are not publicly searchable on YouTube but are accessible via a direct link.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">5. Disclaimers</h2>
            <p>
              The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis. We make no warranty that the Service will be uninterrupted, timely, secure, or error-free. CereBro is a fan-made project and is not affiliated with Marvel, Kabam, or Netmarble.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">6. Limitation of Liability</h2>
            <p>
              In no event shall CereBro or its administrators be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">7. Changes to Terms</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any changes by posting the new Terms of Service on this page.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">8. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact the bot administrator in the Discord server.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

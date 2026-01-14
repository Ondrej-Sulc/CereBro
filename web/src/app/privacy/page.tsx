import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-muted-foreground">
          <p><strong>Last Updated:</strong> November 10, 2025</p>

          <p>
            This Privacy Policy describes how CereBro (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, and discloses your information when you use our Discord bot and associated web services (collectively, the &quot;Service&quot;).
          </p>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
            <p>
              We collect information that you provide directly to us, information we collect automatically, and information we receive from third parties.
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><strong>Information You Provide:</strong> This includes your Discord user ID, MCOC in-game name, and any data you explicitly provide through commands, such as your champion roster, prestige values, and war video submissions.</li>
              <li><strong>Information from Third Parties:</strong> We interact with the Discord API to get your user ID and server information. When you upload a video, we use the YouTube Data API to upload the video to our designated channel.</li>
              <li><strong>Content You Provide:</strong> We collect the video files you upload and the associated metadata you provide, such as fight details (attackers, defenders, nodes), war season, tier, and descriptions.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">2. How We Use Your Information</h2>
            <p>
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Provide, operate, and maintain our Service.</li>
              <li>Process your commands and manage your data within the bot (e.g., update your roster or prestige).</li>
              <li>Upload your submitted videos to our public or alliance-only YouTube channel as directed by you.</li>
              <li>Create a searchable and viewable database of Marvel Contest of Champions war videos for the community.</li>
              <li>Analyze usage to improve the Service.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">3. How We Share Your Information</h2>
            <p>
              We may share your information in the following situations:
            </p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><strong>With YouTube:</strong> When you upload a video, the video file and its title/description are sent to Google via the YouTube Data API to be published on our channel. The privacy of the video (unlisted or public) is handled according to your selection during upload.</li>
              <li><strong>With Other Users:</strong> Information you make public, such as your in-game name, roster (if shared), and submitted videos, may be visible to other users in your Discord server or on our website.</li>
              <li><strong>For Compliance and Safety:</strong> We may disclose information if required by law or if we believe in good faith that such action is necessary to comply with legal processes or protect the rights, property, or safety of our users or the public.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">4. Data Storage and Security</h2>
            <p>
              Your data, including metadata about your video uploads, is stored securely in our PostgreSQL database. Video files are temporarily stored on our server during the upload process to YouTube and are deleted immediately after. We take reasonable measures to protect your information from loss, theft, misuse, and unauthorized access.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">5. Your Rights</h2>
            <p>
              You have the right to request the deletion of your personal data associated with the bot. You can do this by contacting the bot administrator. Please note that videos uploaded to YouTube may be subject to YouTube&apos;s policies.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">6. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">7. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact the bot administrator in the Discord server.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

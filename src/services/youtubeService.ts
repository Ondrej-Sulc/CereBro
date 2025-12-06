import { google } from 'googleapis';
import fs from 'fs';
import loggerService from './loggerService';
import { prisma } from './prismaService';

/**
 * @fileoverview
 * This service handles all interactions with the YouTube Data API,
 * specifically for uploading videos to a designated channel.
 *
 * @see https://developers.google.com/youtube/v3/guides/uploading_a_video
 *
 * @requires Google Cloud Project with YouTube Data API v3 enabled.
 * @requires OAuth 2.0 Credentials (client_id, client_secret).
 * @requires An OAuth 2.0 Refresh Token stored in the database.
 */

// --- CONFIGURATION ---
// TODO: Replace with your actual OAuth 2.0 credentials from the Google Cloud Console.
// SEE: https://console.cloud.google.com/apis/credentials
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || 'YOUR_CLIENT_ID';
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

class YouTubeService {
  private oauth2Client;
  private youtube;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    });

    // Verify authentication on startup (optional, but good for logging)
    this.testAuthentication();
  }

  private async ensureAuthenticated() {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'YOUTUBE_REFRESH_TOKEN' },
    });

    if (!config?.value) {
      throw new Error('YouTube refresh token not found in database. Please configure it via the Admin Dashboard.');
    }

    this.oauth2Client.setCredentials({
      refresh_token: config.value,
    });
  }

  private async testAuthentication() {
    try {
      await this.ensureAuthenticated();
      // The getAccessToken method will automatically use the refresh token to get a new access token.
      const tokenInfo = await this.oauth2Client.getAccessToken();
      if (tokenInfo.token) {
        loggerService.info('Successfully authenticated with YouTube API.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      loggerService.warn({
        error: errorMessage,
        suggestion:
          'Please log in via the Admin Dashboard to configure YouTube access.',
      }, 'YouTube API authentication check failed (non-critical until upload attempted).');
    }
  }

  /**
   * Uploads a video to the configured YouTube channel.
   * @param videoPath - The absolute local path to the video file.
   * @param title - The title of the video.
   * @param description - The description of the video.
   * @returns The ID of the uploaded YouTube video.
   */
  public async uploadVideo(
    videoPath: string,
    title: string,
    description: string,
    privacyStatus: 'private' | 'unlisted' | 'public' = 'private'
  ): Promise<string | null> {
    loggerService.info({ title, privacyStatus }, 'Starting YouTube video upload.');

    try {
      await this.ensureAuthenticated();

      const response = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description,
            // TODO: Add tags if needed, e.g., ['mcoc', 'alliance-war', 'gaming']
            tags: [],
          },
          status: {
            privacyStatus,
          },
        },
        media: {
          body: fs.createReadStream(videoPath),
        },
      });

      const videoId = response.data.id;
      if (videoId) {
        loggerService.info({
          videoId,
          title,
        }, 'Successfully uploaded video to YouTube.');
        return videoId;
      } else {
        loggerService.error({
          response: response.data,
        }, 'YouTube API did not return a video ID.');
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      loggerService.error({
        error: errorMessage,
        title,
      }, 'Failed to upload video to YouTube.');
      throw error;
    }
  }

  /**
   * Updates the privacy status of a YouTube video.
   * @param videoId - The ID of the YouTube video to update.
   * @param privacyStatus - The new privacy status.
   */
  public async updateVideoPrivacy(
    videoId: string,
    privacyStatus: 'private' | 'unlisted' | 'public'
  ): Promise<void> {
    loggerService.info({ videoId, privacyStatus }, 'Updating YouTube video privacy.');
    try {
      await this.ensureAuthenticated();
      
      await this.youtube.videos.update({
        part: ['status'],
        requestBody: {
          id: videoId,
          status: { privacyStatus },
        },
      });
      loggerService.info({ videoId }, 'Successfully updated video privacy.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      loggerService.error({
        error: errorMessage,
        videoId,
      }, 'Failed to update video privacy.');
      throw error;
    }
  }

  /**
   * Deletes a video from YouTube.
   * @param videoId - The ID of the YouTube video to delete.
   */
  public async deleteVideo(videoId: string): Promise<void> {
    loggerService.info({ videoId }, 'Deleting YouTube video.');
    try {
      await this.ensureAuthenticated();
      
      await this.youtube.videos.delete({
        id: videoId,
      });
      loggerService.info({ videoId }, 'Successfully deleted video from YouTube.');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      loggerService.error({
        error: errorMessage,
        videoId,
      }, 'Failed to delete video from YouTube.');
      throw error;
    }
  }

  /**
   * Constructs the URL for the uploaded video.
   * @param videoId - The ID of the YouTube video.
   * @returns The full URL to the video.
   */
  public getVideoUrl(videoId: string): string {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  public getVideoId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('v');
    } catch (error) {
      loggerService.error({ error, url }, 'Failed to parse YouTube URL');
      return null;
    }
  }
}

let youTubeServiceInstance: YouTubeService | null = null;

export function getYouTubeService(): YouTubeService {
    if (!youTubeServiceInstance) {
        youTubeServiceInstance = new YouTubeService();
    }
    return youTubeServiceInstance;
}
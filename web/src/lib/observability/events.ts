export const ObservabilityEvents = {
  clientEvent: "web_client_event",
  deploymentMismatchReloaded: "web_deployment_mismatch_reloaded",
  serverOperationCompleted: "web_server_operation_completed",
} as const;

export const ProductEvents = {
  allianceJoinRequested: "alliance_join_requested",
  questCounterSaved: "quest_counter_saved",
  questPlanViewed: "quest_plan_viewed",
  rosterUploadCompleted: "roster_upload_completed",
  supportCheckoutStarted: "support_checkout_started",
  supportWebhookCompleted: "support_webhook_completed",
  warFightUpdated: "war_fight_updated",
  warPlanCreated: "war_plan_created",
  warPlanDistributed: "war_plan_distributed",
} as const;

export type ObservabilityEventName =
  (typeof ObservabilityEvents)[keyof typeof ObservabilityEvents];

export type ProductEventName =
  (typeof ProductEvents)[keyof typeof ProductEvents];

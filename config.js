/* StudySpot configuration. Edit this file; nothing else needs to change.

   Links for testing, honored only when mode is "preview":
     ?c=A or ?c=B   force a version
     ?sim=1         show simulated dialogs instead of the browser's real prompts
     ?reset=1       forget the saved session in this tab and start over
   Honored in both modes:
     ?pilot=1       adds a P to the front of the app code so pilot rows can be dropped */

window.STUDY_CONFIG = {
  // "preview": for building and testing. Shows a preview banner, allows the test links above,
  //            and works before the Google Form is set up.
  // "research": for participants. No banner, no test links, no simulated dialogs, and the page
  //            refuses to start until formUrl and every entry ID below are filled in.
  // Any other value is treated as "research".
  mode: "preview",

  appName: "StudySpot",

  // Requested in this order. The app supports exactly these three.
  permissions: ["location", "camera", "microphone"],

  // Approved wording (IRB Appendix F). Do not change without an approved amendment.
  wording: {
    welcome: "Welcome to StudySpot, a sample study-helper app. Tap Start to try it.",
    start: "Start",
    // Shown in Version B only. Version A shows the same screen with this space left empty.
    reasons: {
      location: "StudySpot uses your location to show study spots near you.",
      camera: "StudySpot uses your camera to scan your notes.",
      microphone: "StudySpot uses your microphone to record voice notes."
    },
    proceed: "Continue",
    thanks: "Thanks for trying StudySpot! Tap Continue for a short survey."
  },

  // true:  Version A asks as soon as each permission screen appears (the approved design).
  //        Version B shows its sentence and asks after a Continue tap.
  //        One exception: after a reload, the screen in progress waits for Continue in
  //        both versions, because a prompt fired by a page load has no tap behind it.
  // false: both versions ask after one Continue tap per screen. Use this if phone browsers
  //        do not show prompts reliably without a fresh tap, and update the IRB wording to match.
  autoPromptVersionA: true,

  // The Google Form. Use the form's long /viewform address (not a forms.gle short link),
  // and the entry IDs from the form's "Get pre-filled link".
  formUrl: "https://docs.google.com/forms/d/e/REPLACE_WITH_FORM_ID/viewform",
  formEntries: {
    version: "entry.REPLACE_VERSION",
    location: "entry.REPLACE_LOCATION",
    camera: "entry.REPLACE_CAMERA",
    microphone: "entry.REPLACE_MICROPHONE",
    appCode: "entry.REPLACE_APP_CODE"
  },

  // Must match the form's answer choices character for character, or Google Forms drops the
  // prefilled answer. Check the apostrophe in "Don't Allow": the form must use the same
  // straight ' typed here, not a curly one pasted from a document.
  labels: {
    allow: "Allow",
    deny: "Don't Allow",
    notShown: "Prompt not shown"
  },

  // An answer that comes back faster than this (milliseconds) was not a person tapping a
  // prompt; the browser answered by itself without asking, so it is coded "Prompt not shown".
  // The elapsed time is used once for this decision and never stored.
  instantAnswerMs: 500,

  // How long to wait for a location answer (milliseconds).
  locationTimeoutMs: 30000
};

/* Study configuration. Edit this file; nothing else needs to change.
   URL overrides for testing: ?c=A or ?c=B (force a condition), ?sim=1 (simulate every prompt), ?id=CODE (prefill the participant code). */

window.STUDY_CONFIG = {
  // The fictitious app the participant thinks they are setting up.
  appName: "Nearlo",
  tagline: "See what's happening around you",

  // Permissions to request, in order. Each fires the real browser prompt when the
  // browser supports it; otherwise a simulated OS-style dialog is shown and logged as simulated.
  // Available: "location", "notifications", "camera", "microphone", "contacts" (contacts is always simulated).
  permissions: ["location", "notifications", "camera", "microphone"],

  // Condition assignment: "random" (default), "alternate" (per device, uses localStorage), "A", or "B".
  // A = plain request with no reason given. B = the same request with a one-sentence reason.
  assign: "random",

  // true: never fire real prompts, always use the simulated dialog (for demos and desktops without cameras).
  simulateAll: false,

  // Show a "Not now" button on the in-app pre-prompt screen (real apps usually do). Logged as P (pre-declined).
  allowNotNow: true,

  // Seconds the participant must spend on the fake home screen before "Continue" appears.
  feedMinSeconds: 6,

  // Ask for a participant code first (the same code used on the survey). Set false to skip.
  askForCode: true,
  codeHint: "Use the same code you wrote on your survey (first pet's name + two digits, for example).",

  // Questions shown after the reveal screen. type: "single" | "scale" | "multi" | "perms".
  // "perms" builds its options from the permissions list above, plus "None".
  reflection: [
    {
      key: "know",
      type: "single",
      text: "Before this screen, did you know what each permission lets an app do?",
      options: ["Yes", "Sort of", "No"]
    },
    {
      key: "think",
      type: "scale",
      text: "How much did you think about each request before tapping?",
      min: 1, max: 5, minLabel: "Not at all", maxLabel: "A lot"
    },
    {
      key: "change",
      type: "perms",
      text: "Now that you know, which choices would you change?"
    }
  ],

  // Debrief text shown after the reveal. Edit to match the approved consent and debrief language.
  debrief: [
    "Nearlo is not a real app. It was built for a student research study on how people respond to app permission requests.",
    "Nothing was collected from your phone. Your location, camera, microphone, and notifications were never read, recorded, or stored. The only things saved are your yes or no choices, how long each one took, and your answers on the last screen.",
    "Because this page ran in your browser, any permission you allowed applies only to this web page. You can remove it now using the steps below."
  ],

  // Optional: where results go. Leave both blank to have participants copy the result code by hand.
  // 1) A Google Form with one short-answer question: paste the form's /viewform URL and the field's entry id.
  formUrl: "",
  formField: "",
  // 2) Any endpoint that accepts a JSON POST (for example a Google Apps Script web app).
  submitUrl: "",

  // Timeouts (milliseconds).
  locationTimeoutMs: 30000
};

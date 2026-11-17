# IRB check

Each app behavior matched to the approved protocol: Appendix F (the app's screens and wording) and the data collection plan.

**How this was checked.** The "Approved" column below comes from the summary of the approved design used for this update, not from the filed documents themselves. Before collecting data, read each row against the filed copy of Appendix F and the data collection plan, and fix either the app or this file where they disagree. The "Test" column names the automated test that holds the app to the row.

## Appendix F: screens and wording

| # | Approved | App | Test |
|---|---|---|---|
| F1 | App is StudySpot, "a sample study-helper app." Fictional, neutral look, no real brand. | Name, logo, and colors are made up. No brand names or third-party assets. | `handoff.spec.js`: files ship with no third-party code |
| F2 | Welcome, both versions: "Welcome to StudySpot, a sample study-helper app. Tap Start to try it." | Exact sentence, with a Start button. | `flow.spec.js`: Welcome shows the approved sentence |
| F3 | Permissions are location, then camera, then microphone. Nothing else. | Requested in that order, once each. Notifications and contacts are gone. | `flow.spec.js`: Version B, Version A |
| F4 | Location, Version A: the phone's prompt appears immediately. | The prompt is requested as soon as the screen appears, right after the Start tap. | `flow.spec.js`: Version A |
| F5 | Location, Version B: "StudySpot uses your location to show study spots near you." then the prompt. | Exact sentence, a Continue button, then the prompt. | `flow.spec.js`: Version B |
| F6 | Camera, Version A: prompt immediately. Version B: "StudySpot uses your camera to scan your notes." then the prompt. | Same pattern as location. | same |
| F7 | Microphone, Version A: prompt immediately. Version B: "StudySpot uses your microphone to record voice notes." then the prompt. | Same pattern as location. | same |
| F8 | The versions differ only by the reason sentence. | Same screen, same layout. Version A leaves the sentence's space empty. | `flow.spec.js`: Version A and Version B differ only in the reason sentence |
| F9 | Continue, both versions: "Thanks for trying StudySpot! Tap Continue for a short survey." | Exact sentence, with a Continue button. | `flow.spec.js`: Version B |
| F10 | Continue opens the Google Form with the version and three decisions prefilled. | Opens the form in the same tab with Version, Location, Camera, Microphone, and the app code prefilled. | `handoff.spec.js`: Continue opens the prefilled form |
| F11 | Only Allow or Don't Allow are offered. | The in-app "Not now" button is removed. The only choices are the phone's own. | `flow.spec.js` |

## Data collection plan

| # | Approved | App | Test |
|---|---|---|---|
| D1 | Random 1:1 assignment to Version A or B. | One random bit from the browser's cryptographic source. No alternating, no fixed setting. A link cannot force a version in research mode. | `assignment.spec.js` |
| D2 | The app records only the version and, per permission, Allow, Don't Allow, or Prompt not shown. | Those four values are all that is kept. No participant code, timing, device, or browser details. | `handoff.spec.js`: only the version, the step, and the three outcomes are stored |
| D3 | Nothing else is stored or sent. | No network request except the final form navigation. No cookies, no local storage. | `handoff.spec.js`: no network request |
| D4 | Allow: granted. | Includes "allowed, no position fix" and "allowed, device busy." | `outcomes.spec.js` |
| D5 | Don't Allow: refused at the prompt, or the prompt was dismissed. | Same. | `outcomes.spec.js` |
| D6 | Prompt not shown: the browser could not or did not ask, including location switched off for the browser. | Feature missing, a choice already remembered, no camera or microphone, or an answer faster than a person could tap. | `outcomes.spec.js` |
| D7 | The position is never read. Media tracks stop immediately. No third-party code. | The location callback takes no argument. Tracks are stopped in the same step they arrive. | `outcomes.spec.js`: tracks are stopped the moment they arrive |
| D8 | Survey, settings audit, then reveal and debrief (with the mock ad), all in the Google Form, in that order. | The app has no feed, reveal, reflection questions, or debrief. It ends at the form. | `flow.spec.js`, `handoff.spec.js` |
| D9 | Simulated dialogs are never used with participants. | Only in preview mode with `?sim=1`. | `handoff.spec.js`: research mode ignores `?sim=1` |

## Differences and open points

These are the places where the app does something the approved wording may not spell out. Each needs a yes from the filed documents, or a note to the teacher.

1. **Version B has one more tap per permission than Version A.** In B the participant reads the sentence and taps Continue before the prompt. In A the prompt comes by itself. This is how "A: prompt immediately; B: sentence, then the prompt" was built. If Appendix F means the B prompt should also appear by itself, the app needs a change. Setting `autoPromptVersionA` to `false` makes both versions use one Continue tap.
2. **After a reload, the screen in progress waits for a Continue tap in both versions.** A prompt fired by a page load has no tap behind it, and phone browsers are least reliable there. This only affects a participant who reloads partway through.
3. **Prompt timing has not been tried on real phones.** The automated tests use desktop builds of the two browser engines at phone size. The check on an iPhone in Safari and an Android phone in Chrome is described in the README and has to pass before data collection.
4. **"Prompt not shown" also covers an instant answer of either kind, and unexpected errors.** An Allow or a refusal that returns in under half a second is coded "Prompt not shown," because no person answered a prompt that fast. So is a camera or microphone error the app does not recognize.
5. **A location prompt left unanswered until it times out (30 seconds) is coded Don't Allow.** It was shown and not accepted.
6. **Limits of "Prompt not shown."** If a browser setting allows a permission for every site and the grant takes longer than half a second, the app cannot tell it from a tapped Allow. Chrome on Android may show a smaller, quieter location prompt to people who usually refuse; if it goes unanswered the app records Don't Allow.
7. **The app code.** The form is also prefilled with a short code such as `SS1-B-ADN` that repeats the version and the three outcomes, because Google Forms lets a person edit a prefilled answer. It adds no new information. Check that the data collection plan lists it as a collected field. Pilot runs opened with `?pilot=1` carry a leading `P`.
8. **Where the values sit before the form.** The version, the current step, and the outcomes are kept in the browser tab's session storage on the participant's own phone until the tab closes. Nothing leaves the phone until the participant opens the form.
9. **What else is on screen.** The Welcome and Continue screens show the app's name and logo above the approved sentence. The permission screens show a small bar with the name and logo, and three animated dots while a prompt is open. There are no other words.
10. **The phone's prompt names the website address, not StudySpot.** Browsers ask on behalf of the site.
11. **Permissions outlast the session.** A permission a participant allows stays allowed for the site address until they remove it. The removal steps drafted for the form's debrief are new text and need the teacher's approval (`FORM_REVEAL_DRAFT.md`).
12. **Participants who leave the form early.** The debrief and the removal steps come at the end of the form, so someone who closes it partway sees neither. Worth confirming how the approved plan handles that.
13. **The address.** GitHub Pages shows the repository name in the address bar. The repository should be renamed so the address does not describe the study.

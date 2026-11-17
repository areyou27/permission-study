# StudySpot

A one-page mobile web app for a student research study. StudySpot presents itself as "a sample study-helper app," asks for three phone permissions the way a real app would, records each decision, and hands the participant to a Google Form for the survey. It is fictional, has a plain look, and uses no real brand.

The study compares two versions of the same request: Version A asks with no explanation, Version B gives a one-sentence reason first. Participants are assigned to one at random, with equal chance.

## What the participant sees

| # | Screen | Version A (plain) | Version B (explained) |
|---|---|---|---|
| 1 | Welcome | "Welcome to StudySpot, a sample study-helper app. Tap Start to try it." | same |
| 2 | Location | the phone's prompt appears at once | "StudySpot uses your location to show study spots near you." then Continue, then the prompt |
| 3 | Camera | the phone's prompt appears at once | "StudySpot uses your camera to scan your notes." then Continue, then the prompt |
| 4 | Microphone | the phone's prompt appears at once | "StudySpot uses your microphone to record voice notes." then Continue, then the prompt |
| 5 | Continue | "Thanks for trying StudySpot! Tap Continue for a short survey." | same |

Screens 2 to 4 are one screen in the page. The two versions differ only in the reason sentence. Version A leaves that space empty, and the button sits at the bottom of the screen in both, so nothing moves.

The survey, the settings audit, and the reveal and debrief all happen in the Google Form, in that order. The app itself never says what the study is about.

## What is recorded

Only two things:

- the version, `A` or `B`
- for each permission, one of three outcomes: `Allow`, `Don't Allow`, or `Prompt not shown`

They are kept in the browser tab's session storage until the tab closes, so a reload continues where it left off without assigning a new version or asking again. Tapping Continue on the last screen opens the Google Form in the same tab with those four answers prefilled, plus an app code.

Nothing else is stored or sent. No participant code, no timings, no device or browser details, no free text. The page makes no network request of its own. The position is never read. A camera or microphone track is stopped the instant it arrives. There is no third-party code.

### The three outcomes

| Outcome | When |
|---|---|
| Allow | The person allowed it. This includes "allowed, but no position fix was available" and "allowed, but the camera or microphone was busy." |
| Don't Allow | The person refused at the prompt, or closed the prompt without answering. |
| Prompt not shown | The browser never asked. The feature is missing, the browser already remembered a choice for this site, the phone has no camera or microphone, or the answer came back faster than a person could tap (for example location is switched off for the browser). |

To tell these apart, the page checks what the browser already remembers before asking, and how fast the answer comes back. Neither is stored. The cutoff for "faster than a person" is `instantAnswerMs` in `config.js` (half a second).

### The app code

One short code repeats the same record, for example `SS1-B-ADN`:

- `SS1`: StudySpot, format 1
- `B`: the version
- `ADN`: location, camera, microphone, in that order. `A` Allow, `D` Don't Allow, `N` Prompt not shown

Google Forms lets a person change a prefilled answer, so the app code is the record to trust. Opening the link with `?pilot=1` puts a `P` in front (`PSS1-B-ADN`) so pilot rows can be dropped. `decode.html` turns a pasted column of codes into a table, an Allow rate by version, and a CSV. It is not linked from the app.

## Setting up the Google Form

1. In the form, add four multiple-choice questions and one short-answer question:
   - Version: `A`, `B`
   - Location, Camera, Microphone: `Allow`, `Don't Allow`, `Prompt not shown`
   - App code: short answer
2. The choices must match `labels` in `config.js` character for character, or Google Forms drops the prefilled answer. Type `Don't Allow` in the form with a plain apostrophe. A curly one pasted from a document will not match.
3. Open the form's menu, choose "Get pre-filled link," fill in any answers, and copy the link. It contains one `entry.<number>` for each question.
4. Put the form's long address (ending in `/viewform`, not a `forms.gle` short link) in `formUrl`, and the five entry IDs in `formEntries`.
5. Set `mode` to `"research"`.

In research mode the page refuses to start while `formUrl` or any entry ID is still a placeholder. It shows "This page is not ready yet" and assigns nothing.

## Preview mode and research mode

`mode` in `config.js` is `"preview"` or `"research"`.

| | Preview | Research |
|---|---|---|
| Banner on the Welcome screen | yes, with setup notes | none |
| `?c=A`, `?c=B` (force a version) | honored | ignored |
| `?sim=1` (simulated dialogs) | honored | ignored: never simulated |
| `?reset=1` (start over in this tab) | honored | ignored |
| `?pilot=1` (P on the app code) | honored | honored |
| Form not set up | last screen shows what would be sent | page refuses to start |

Participants should only ever get the research link.

## When each prompt appears

`autoPromptVersionA` in `config.js`:

- `true` (the approved design): Version A asks as soon as each permission screen appears. Version B shows its sentence and asks after a Continue tap.
- `false`: both versions ask after one Continue tap per screen.

The location prompt always follows a tap (Start in Version A, Continue in Version B). After a reload, the screen in progress waits for a Continue tap in both versions, because a prompt fired by a page load has no tap behind it.

**Check on real phones before collecting data.** Open the preview link with `?c=A` on an iPhone in Safari and on an Android phone in Chrome, in a private tab. Tap Start. All three prompts should appear one after another with no further taps, and the last screen should list the answers you gave. If a prompt fails to appear on either phone, set `autoPromptVersionA` to `false` and update the approved wording to match.

## Running it

The page is static: no build step and no server code.

- **On phones:** it must be served over HTTPS, which GitHub Pages does. Browsers do not show permission prompts on plain HTTP.
- **On this computer:** `node tests/serve.js`, then open `http://127.0.0.1:4321/`. Add `?sim=1` to click through with simulated dialogs.

## Tests

```
npm install
npx playwright install chromium webkit
npm test
```

The tests run the page in Chromium and WebKit at phone size, with fake location, camera, microphone, and Permissions APIs that record everything the page does. They cover: about 1:1 assignment from the crypto source; a reload keeps the version and does not ask again; each permission is requested once, in order; every outcome rule; tracks stopped at once; the position never read; no network request except the final form navigation; Version A and Version B differing only in the reason sentence; the exact prefilled values; and both modes.

## Things to know

- Browsers ask "for this website," so the prompt names the site address, not StudySpot.
- A browser does not ask again once it remembers a choice for the site. Those come out as "Prompt not shown." Between test runs, use a private tab or reset the site's permissions.
- Chrome on Android sometimes shows a smaller, quieter location prompt to people who usually refuse. If it goes unanswered the page sees a refusal.
- If a browser setting allows a permission for every site, the browser may grant it without asking. When that takes longer than half a second the page cannot tell it from a tapped Allow.
- All pages under the same `github.io` address share one set of permissions.

## Files

| File | Purpose |
|---|---|
| `index.html` | the five screens |
| `app.js` | flow, permission requests, outcome coding, form handoff |
| `config.js` | mode, wording, form link, labels |
| `styles.css` | phone-like styling, light and dark |
| `decode.html`, `decode.js` | app codes to a table and CSV |
| `tests/` | Playwright tests and a small static server |
| `IRB_CHECK.md` | each app behavior matched to the approved protocol |
| `FORM_REVEAL_DRAFT.md` | draft text for the form's reveal and debrief section |

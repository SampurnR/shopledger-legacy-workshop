# Ticket 3 evidence

## Checkpoints

### CP1 Explanation

Rendered copy of the Codex explanation produced in this session; folder and read-only phase are visible. This is not a native desktop-chat screenshot.

![CP1 saved explanation](cp1-explanation.jpg)

### CP2 Architecture

![Architecture open on screen](cp2-architecture.jpg)

### CP3 Characterization tests

Authentic saved Node output, rendered for readability. [Raw output](cp3-characterization.txt).

![21 passing characterization tests](cp3-characterization.jpg)

### CP4 Failing and passing tests

Summaries are extracted from the unedited logs. [Red log](cp4-regression-red.txt), [green log](cp4-regression-green.txt), [review refinement red log](review-overflow-red.txt).

![Red and green test evidence](cp4-tests-red-green.jpg)

### CP4 Original and fixed app

All app captures use disposable copies. The final checkout's database is unchanged.

Original chronology:
![Original order history](app-before-order-history.jpg)

Fixed chronology:
![Correct order history](app-after-order-history.jpg)

Original January filter (incorrectly includes other months):
![Original January filter](app-before-january-filter.jpg)

Fixed January filter (1004, 1003, 1002 only):
![Correct January filter](app-after-january-filter.jpg)

Original settlement (1200500 settled, -1198067.99 balance):
![Corrupted original balance](app-before-khata-corrupted.jpg)

Fixed settlement (1700 settled, 732.01 balance):
![Correct balance](app-after-khata-corrected.jpg)

API observations: [before](app-before-api.json), [after](app-after-api.json).

### CP5 Pull request

![Unmerged pull request](cp5-pull-request.jpg)

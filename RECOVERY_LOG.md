# SEM Application Recovery Log
This file tracks all critical modifications made to the Student Event Manager (SEM) codebase to ensure transparency and provide a reference for reverting changes if necessary.

## [2026-04-07] - Sprint: Stability & Feature Fixes

### 1. Fix: Event Poster Visibility
- **Modified**: `src/utils.js` & `src/components/EventCard.jsx`
- **Change**: Updated `getDefaultPoster` to return high-quality thematic image URLs from Unsplash based on the event category (Hackathon, Workshop, etc.) instead of `null`. Updated `PosterImage` component to actively fetch these fallbacks if no server poster is found.
- **Rationale**: User reported posters were "not visible" (showing generic fallbacks). Now every event has a professional visual representative.

### 2. Fix: Event Tab Filtering & Rendering Errors
- **Modified**: `src/components/EventList.jsx`
- **Change 1**: Fixed the filtering logic (Line 155) to use `.includes()` for event types. Since `eventType` is now stored as an array to support multi-categorization, a simple `===` check was failing.
- **Change 2**: Updated the table view rendering (Line 64) to handle array-based event types by joining them with bullets (` • `).
- **Rationale**: User reported errors when clicking the Event tab, caused by React attempting to render arrays directly and filtering logic returning empty results.

### 3. Stability: Tactical Unit Join Flow
- **Modified**: `src/components/JoinTeam.jsx`
- **Change**: Improved teammate detection, added "Switch Team" support, and enhanced immediate Store synchronization. Added better error messaging for authorization and "already leader" scenarios.
- **Rationale**: User reported joining teams was not working properly.

---

## [2026-04-07] - Sprint: Real-time Notifications & Hierarchy Refinement

### 1. Fix: Enhanced Real-time Notifications
- **Modified**: `src/services/firebase.js`
- **Change**: Refined the `docChanges` logic in multiple listeners. 
    - **Events**: Increased detection window from 2 to 5 minutes and added `updatedAt` tracking to ensure "Mission Updates" are never missed.
    - **Team Members**: Added a new notification trigger for Team Leaders. When a new member joins the unit, the leader receives a `New Unit Member` notification in real-time.
- **Rationale**: User reported "notification issues still there." Foreground synchronization is now more aggressive and covers more lifecycle events.

### 2. Feature: Tactical Unit Hierarchy (Promote/Leave)
- **Modified**: `src/components/Dashboard.jsx`
- **Change**: Added a "Promote to Leader" option for team members. 
- **Functionality**: 
    - Members can now either "Leave Team" (return to solo) or "Self-Promote" (establish their own workspace as a leader). 
    - Invitation controls are now strictly reserved for Leaders/Admins to prevent unauthorized unit expansion.
- **Rationale**: User requested specific roles/functionalities for team leaders and members, including self-promotion.

---
*End of log entries for this session.*

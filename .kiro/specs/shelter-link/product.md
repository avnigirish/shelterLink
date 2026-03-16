# ShelterLink — Product Impact & Need

## Problem Statement

Emergency shelters and community resource centers operate under constant pressure with limited staff and no reliable way to communicate real-time capacity to the people who need it most. Shelter managers currently rely on phone calls, paper logs, or manual website updates to share bed availability and supply needs — a process that is slow, error-prone, and inaccessible to volunteers and donors acting in the field.

This gap causes real harm: donors arrive with supplies that aren't needed, volunteers show up to shelters that are full, and vulnerable community members are turned away from resources that exist elsewhere.

## Solution

ShelterLink is a lightweight, serverless platform that lets shelter staff send a simple SMS to update their capacity and needs in real time. Those updates are instantly reflected on a public-facing React dashboard that any volunteer, donor, or community member can access without an account or technical knowledge.

## Target Users

### Shelter Managers
- Non-technical staff who manage day-to-day shelter operations
- Need a zero-friction way to update capacity (beds, meals, supplies) without logging into a system
- May be operating from a mobile phone in a high-stress environment

### Community Volunteers & Donors
- People who want to help but need accurate, up-to-date information before acting
- Range from tech-savvy to older adults with limited digital literacy
- Need a dashboard that is immediately understandable and accessible

## Impact Alignment (AWS Reachback Hackathon)

ShelterLink directly addresses the hackathon theme "Build for Impact — Code That Matters to Your Community" by:

- Reducing wasted resources through accurate, real-time needs matching
- Lowering the barrier to participation for non-technical shelter staff via SMS
- Serving vulnerable populations by ensuring accessibility (WCAG 2.1) for older and disabled users
- Leveraging AWS serverless infrastructure for low-cost, high-reliability operation at community scale

## Success Metrics

- A shelter manager can update capacity in under 60 seconds via SMS
- Dashboard reflects updates within 5 seconds of SMS receipt
- Dashboard is usable without JavaScript disabled and passes WCAG 2.1 AA contrast and navigation checks
- Zero infrastructure management required by shelter operators

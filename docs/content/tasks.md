# Bridle tasks: briefs, rubrics and reference answers

> This file is generated from the task data of `packages/tasks` by `pnpm --filter @bridle/tasks run docs`. Do not edit it by hand: correct the task in `packages/tasks/src/tasks/` and run that command again. A test of the package fails while this file differs from what the command writes.

This document shows the 3 seeded tasks of the showcase as a learner and an instructor meet them: the brief, what the learner must report, the design requirements, the rubric, and the reference answers.

How to read it:

- Units: forces in kN, lengths in m, moments in kN·m, stresses in MPa, deflections in mm. Global axes are right-handed with Z up; gravity acts along −Z. A frame drawn in a plane lies in the X-Z plane.
- Loads are service (unfactored) values. The limits on deflection and sway are requirements of the tasks themselves; no design code is applied, and the analysis is linear-elastic.
- A reference answer is computed: the solver (`packages/solver`) analyses the task's reference model and the value is read from its results. An answer marked PENDING has no reference value yet.
- An answer is accepted within a tolerance with a relative and an absolute part: the difference from the reference value may be up to the larger of the two. A signed answer follows the global axes; a magnitude has no sign.
- Every rubric criterion has a weight (the weights of a task sum to 100 %) and says what it is assessed from: the learner's model, the solver's results for that model, the typed answers, or the written justification.

## Task 1. Simply supported beam

Level: Introductory. Task id: `simply-supported-beam`.

### Brief

A steel floor beam spans 6 m between two walls and carries a uniformly distributed load of 15 kN/m over its whole length. The load is a service (unfactored) value and already includes the self-weight of the beam; do not add self-weight. The beam is the generic I-section I 300x150 (300 mm deep, 150 mm wide), bending about its strong axis, in steel with a modulus of elasticity E = 210 000 MPa.

The beam is simply supported: a pin at A, the left end, and a roller at B, the right end, which is free to move along the beam. Nodes A (x = 0), C (x = 3 m, mid-span) and B (x = 6 m) are already placed on the global X axis; Z is up and gravity acts along −Z.

Model the beam. Draw it as two members, A to C and C to B, so that the mid-span deflection can be read at node C. Give it its supports. Apply the load to both members in load case LC1.

The workspace analyses the model in three dimensions, so the supports must also do what a drawing in one plane takes for granted: hold both ends against moving sideways (along Y), and hold one end against twisting about the beam's own axis (rotation about X). A model that is not held in every direction is reported as unstable and has no results. Do not hold the bending rotation (about Y) at either end: that would make the end fixed, not simply supported.

Read the results and report the values listed below. Before you submit, check each of them by hand calculation.

### Given

| Quantity | Value |
| --- | --- |
| Span, A to B | 6 m |
| Uniformly distributed load (service value, self-weight included) | 15 kN/m, downward |
| Section | I 300x150, strong axis |
| Modulus of elasticity, E | 210 000 MPa |
| Supports | pin at A, roller at B |

### Learning outcomes

- Represent a simply supported beam as a model of nodes, members, a pin and a roller.
- Restrain a plane structure completely in a three-dimensional analysis without adding restraint in its own plane.
- Apply a uniformly distributed load in the direction of gravity.
- Read reactions, bending moment and deflection from the results and check them against wL/2, wL²/8 and 5wL⁴/(384EI).

### What the learner starts with

The starting model has 3 nodes, 1 section, the material S355, the load case LC1. It has no members, no supports, no loads: the learner adds them.

- Nodes (x, y, z in m): A (0, 0, 0), C (3, 0, 0), B (6, 0, 0).

Fixed (the learner cannot change or delete them): nodes A, C, B; sections I 300x150; material steel; load case LC1.

### What the learner must report

| No. | Answer | Unit | Sign | Accepted within |
| --- | --- | --- | --- | --- |
| 1 | Vertical reaction at support A (magnitude) | kN | magnitude | 1 % or 0.05 kN, whichever is larger |
| 2 | Vertical reaction at support B (magnitude) | kN | magnitude | 1 % or 0.05 kN, whichever is larger |
| 3 | Maximum bending moment in the beam, at mid-span (magnitude) | kN·m | magnitude | 1 % or 0.05 kN·m, whichever is larger |
| 4 | Deflection at mid-span, node C (magnitude, downward) | mm | magnitude | 2 % or 0.05 mm, whichever is larger |

Written justification: In three to five sentences: show how you checked the reactions, the maximum moment and the deflection by hand (the formulas and the numbers you got), and say by what factor the mid-span deflection would change if the span were doubled with the same load per metre and the same section.

### Design requirements

This task sets no design requirement.

### Rubric

| Criterion | Weight | Assessed from | Not shown | Developing | Proficient | Exemplary |
| --- | --- | --- | --- | --- | --- | --- |
| Model and supports | 30 % | model, results | No members connect A to B, or the model has no supports, or it is reported as unstable. | The beam is drawn and the model solves, but the supports do not make it simply supported in its plane: the rotation about Y is held at A or B, or both ends are held along X, or node C is supported. | The beam runs from A through C to B with section I 300x150; one end is held along X, Y and Z and the other along Y and Z with X free; no rotation about Y is held; the model solves. | As proficient, with the pin at A and the roller at B as the brief has them, the twist about X held at one end only and nothing else restrained. |
| Loads | 20 % | model | No load is applied to the beam in load case LC1. | A load is applied but it differs from the brief: it is not 15 kN/m, or one of the two members is unloaded, or it acts upward or along another axis, or it is entered as point loads. | Both members carry a uniform load of 15 kN/m along global −Z in LC1, a total of 90 kN, and nothing else is loaded. | As proficient, and the justification shows that the two vertical reactions sum to the total applied load of 90 kN. |
| Reported results | 30 % | answers, results | No answers are given, or none of the four is within its tolerance. | One or two of the four answers are within tolerance. | Three of the four answers are within tolerance. | All four answers are within tolerance. |
| Engineering judgement and justification | 20 % | justification | No justification is written, or it does not refer to this beam. | The justification repeats the software's results without an independent check, or names formulas without the numbers they give. | The justification gives hand values for the reactions, the maximum moment and the deflection from wL/2, wL²/8 and 5wL⁴/(384EI) and compares them with the results. | As proficient, and it states that doubling the span multiplies the mid-span deflection by 16, because the deflection varies with the fourth power of the span. |

### Reference answers

Computed by the solver from the reference model below; none of these numbers is typed in.

- Nodes (x, y, z in m): A (0, 0, 0), C (3, 0, 0), B (6, 0, 0).
- Members: AC from A to C (frame, I 300x150); CB from C to B (frame, I 300x150).
- Supports: A holds ux, uy, uz, rx; B holds uy, uz.
- Loads: 15 kN/m on member AC along global −Z (LC1); 15 kN/m on member CB along global −Z (LC1).

| No. | Answer | Reference value | Unit |
| --- | --- | --- | --- |
| 1 | Vertical reaction at support A (magnitude) | 45.00 | kN |
| 2 | Vertical reaction at support B (magnitude) | 45.00 | kN |
| 3 | Maximum bending moment in the beam, at mid-span (magnitude) | 67.50 | kN·m |
| 4 | Deflection at mid-span, node C (magnitude, downward) | 14.79 | mm |

## Task 2. Portal frame under wind and gravity

Level: Intermediate. Task id: `portal-frame-wind-gravity`.

### Brief

A single-bay steel portal frame is 8 m wide and 5 m high, in the global X-Z plane (Z is up). The columns A-B (left) and D-C (right) are the generic I-section I 300x150 and the beam B-C is I 400x180, all bending about their strong axes in the plane of the frame; the steel has a modulus of elasticity E = 210 000 MPa. The beam is rigidly connected to the columns, and both column bases, A and D, are fixed.

The frame carries two loads at the same time, both service (unfactored) values, in the one load case LC1: a uniformly distributed gravity load of 30 kN/m on the beam, which includes the self-weight of the members (do not add self-weight), and a wind load represented by a horizontal force of 20 kN at the top of the left column, node B, acting along +X.

The nodes and the three members are given and cannot be changed. Add the supports and the two loads. A fixed base holds all three translations and all three rotations of its node.

Report the values listed below. Give the two horizontal reactions with their signs, positive along +X; give every other value as a magnitude.

Requirement of this task: the sway of the frame, measured as the horizontal displacement of node B, must not exceed the column height divided by 300. Judge the frame against this limit in your written answer.

### Given

| Quantity | Value |
| --- | --- |
| Width, A to D | 8 m |
| Height, bases to beam | 5 m |
| Columns A-B and D-C | I 300x150, strong axis in the plane of the frame |
| Beam B-C | I 400x180, strong axis in the plane of the frame |
| Modulus of elasticity, E | 210 000 MPa |
| Bases A and D | fixed |
| Gravity load on the beam (service value, self-weight included) | 30 kN/m, downward |
| Wind force at node B (service value) | 20 kN along +X |
| Sway limit | height / 300 |

### Learning outcomes

- Model fixed bases, and apply a member load and a nodal load in one load case.
- Read base reactions and base moments with their signs and check them by the equilibrium of the whole frame.
- Explain how gravity and lateral load combine at the two bases, and why the reactions at the two bases differ.
- Judge a sway against a stated drift limit and say which members control it.

### What the learner starts with

The starting model has 4 nodes, 3 members, 2 sections, the material S355, the load case LC1. It has no supports, no loads: the learner adds them.

- Nodes (x, y, z in m): A (0, 0, 0), B (0, 0, 5), C (8, 0, 5), D (8, 0, 0).
- Members: AB from A to B (frame, I 300x150); BC from B to C (frame, I 400x180); DC from D to C (frame, I 300x150).

Fixed (the learner cannot change or delete them): nodes A, B, C, D; members AB, BC, DC; sections I 300x150, I 400x180; material steel; load case LC1.

### What the learner must report

| No. | Answer | Unit | Sign | Accepted within |
| --- | --- | --- | --- | --- |
| 1 | Horizontal reaction at base A (signed, positive along +X) | kN | signed | 1 % or 0.05 kN, whichever is larger |
| 2 | Horizontal reaction at base D (signed, positive along +X) | kN | signed | 1 % or 0.05 kN, whichever is larger |
| 3 | Vertical reaction at base A (magnitude) | kN | magnitude | 1 % or 0.05 kN, whichever is larger |
| 4 | Vertical reaction at base D (magnitude) | kN | magnitude | 1 % or 0.05 kN, whichever is larger |
| 5 | Moment reaction at base A, about the axis normal to the frame (magnitude) | kN·m | magnitude | 1 % or 0.05 kN·m, whichever is larger |
| 6 | Moment reaction at base D, about the axis normal to the frame (magnitude) | kN·m | magnitude | 1 % or 0.05 kN·m, whichever is larger |
| 7 | Sway: horizontal displacement of node B (magnitude) | mm | magnitude | 2 % or 0.05 mm, whichever is larger |
| 8 | Sway at B divided by the sway limit (height / 300) | none (a ratio) | magnitude | 2 % or 0.005, whichever is larger |

Written justification: In four to six sentences: state the sway at B and the limit in mm and whether the frame meets the limit; show your equilibrium check of the reactions; explain why the base moment at D is larger than the one at A; and say which single change would reduce the sway more, stiffer columns or a stiffer beam, and why.

### Design requirements

| Requirement | Limit as data | Reference design | Verdict |
| --- | --- | --- | --- |
| The horizontal displacement of node B under the given loads must not exceed the column height divided by 300: 5 m / 300 = 16.7 mm. | drift ux at node B ≤ 5 m / 300 = 16.67 mm | 7.78 mm against 16.67 mm (ratio 0.467) | met |

### Rubric

| Criterion | Weight | Assessed from | Not shown | Developing | Proficient | Exemplary |
| --- | --- | --- | --- | --- | --- | --- |
| Model and supports | 20 % | model, results | No support is added, or the model is reported as unstable. | The model solves, but a base is not fixed: at A or D one of the six restraints is missing (for example a pinned base, with the rotation about Y free), or node B or C is supported. | A and D each hold all three translations and all three rotations, and no other node is supported. | As proficient, and the justification says what the fixed bases contribute: that the frame can have base moments only because the rotation about Y is held there. |
| Loads | 20 % | model | No load is applied in LC1. | Only one of the two loads is applied, or a load differs from the brief in value, direction or position (for example the wind force along −X or on another node, or the beam load upward). | The beam B-C carries 30 kN/m along global −Z and node B carries 20 kN along +X, both in LC1, and nothing else is loaded. | As proficient, and the justification shows the equilibrium check with numbers: the horizontal reactions sum to −20 kN and the vertical reactions sum to 240 kN. |
| Reported results | 30 % | answers, results | No answers are given, or none of the eight is within its tolerance. | One to five of the eight answers are within tolerance. | Six or seven of the eight answers are within tolerance. | All eight answers are within tolerance, the two horizontal reactions with their signs. |
| Drift judgement and justification | 30 % | justification, results | No justification is written, or it gives no verdict on the sway limit. | A verdict is given but the numbers do not support it: the sway or the limit (5 m / 300 = 16.7 mm) is missing or wrong, or the verdict contradicts the numbers stated. | The sway and the limit are both stated in mm, the verdict follows from them (the frame meets the limit), and an equilibrium check of the horizontal or the vertical reactions is shown. | As proficient, and the justification explains that the base moments from wind and from gravity act in the same sense at D and in opposite senses at A, and argues from the frame's behaviour which members control the sway. |

### Reference answers

Computed by the solver from the reference model below; none of these numbers is typed in.

- Nodes (x, y, z in m): A (0, 0, 0), B (0, 0, 5), C (8, 0, 5), D (8, 0, 0).
- Members: AB from A to B (frame, I 300x150); BC from B to C (frame, I 400x180); DC from D to C (frame, I 300x150).
- Supports: A holds all six (ux, uy, uz, rx, ry, rz); D holds all six (ux, uy, uz, rx, ry, rz).
- Loads: 30 kN/m on member BC along global −Z (LC1); on node B: fx = 20 kN (LC1).

| No. | Answer | Reference value | Unit |
| --- | --- | --- | --- |
| 1 | Horizontal reaction at base A (signed, positive along +X) | 15.61 | kN |
| 2 | Horizontal reaction at base D (signed, positive along +X) | -35.61 | kN |
| 3 | Vertical reaction at base A (magnitude) | 114.30 | kN |
| 4 | Vertical reaction at base D (magnitude) | 125.70 | kN |
| 5 | Moment reaction at base A, about the axis normal to the frame (magnitude) | 15.36 | kN·m |
| 6 | Moment reaction at base D, about the axis normal to the frame (magnitude) | 69.78 | kN·m |
| 7 | Sway: horizontal displacement of node B (magnitude) | 7.78 | mm |
| 8 | Sway at B divided by the sway limit (height / 300) | 0.467 | none (a ratio) |

## Task 3. Choose the beam

Level: Intermediate. Task id: `choose-the-beam`.

### Brief

A steel floor beam spans 7 m and is simply supported. It carries a uniformly distributed load of 25 kN/m over its whole length. The load is a service (unfactored) value and includes an allowance for the beam's self-weight whichever section is chosen; do not add self-weight. The steel has a modulus of elasticity E = 210 000 MPa and a yield strength of 355 MPa.

The beam is modelled for you: nodes A (x = 0), C (x = 3.5 m, mid-span) and B (x = 7 m), the members A-C and C-B, a pin at A and a roller at B, and the load in load case LC1. You cannot change them. What you choose is the section, the same for both members, from this list of generic I-sections, lightest first: I 300x150, I 330x160, I 360x170, I 400x180, I 450x190, I 500x200. The model starts with the lightest, I 300x150.

Requirement of this task: the mid-span deflection under the given load must not exceed the span divided by 360. Choose the lightest section of the list, the one with the least mass per metre, that meets this requirement.

Report the values listed below for the section you chose. One of them is the maximum bending stress in the beam: take it as the maximum bending moment divided by the elastic section modulus about the strong axis, W = Iy / (h/2), with h the depth of the section, and compare it with the yield strength.

Justify your choice in writing.

### Given

| Quantity | Value |
| --- | --- |
| Span, A to B | 7 m |
| Uniformly distributed load (service value, self-weight allowance included) | 25 kN/m, downward |
| Modulus of elasticity, E | 210 000 MPa |
| Yield strength | 355 MPa |
| Supports | pin at A, roller at B |
| Sections to choose from | I 300x150, I 330x160, I 360x170, I 400x180, I 450x190, I 500x200 |
| Deflection limit at mid-span | span / 360 |

### Learning outcomes

- Apply a deflection limit to a beam and express the result as a ratio to the limit.
- Compare candidate sections by their second moment of area and their mass, and select the lightest that meets a requirement.
- Compute an elastic bending stress from the bending moment and the section modulus.
- Justify a design choice with numbers, including why the next lighter section was rejected.

### What the learner starts with

The starting model has 3 nodes, 2 members, 2 supports, 2 loads, 6 sections, the material S355, the load case LC1.

- Nodes (x, y, z in m): A (0, 0, 0), C (3.5, 0, 0), B (7, 0, 0).
- Members: AC from A to C (frame, I 300x150); CB from C to B (frame, I 300x150).
- Supports: A holds ux, uy, uz, rx; B holds uy, uz.
- Loads: 25 kN/m on member AC along global −Z (LC1); 25 kN/m on member CB along global −Z (LC1).

Fixed (the learner cannot change or delete them): nodes A, C, B; members AC, CB; sections I 300x150, I 330x160, I 360x170, I 400x180, I 450x190, I 500x200; material steel; supports at A, B; load case LC1; uniform loads w-AC, w-CB.

The learner's choice: one section for the members AC and CB, from I 300x150, I 330x160, I 360x170, I 400x180, I 450x190, I 500x200.

### What the learner must report

| No. | Answer | Unit | Sign | Accepted within |
| --- | --- | --- | --- | --- |
| 1 | Maximum bending moment in the beam, at mid-span (magnitude) | kN·m | magnitude | 1 % or 0.05 kN·m, whichever is larger |
| 2 | Deflection at mid-span, node C, with the section you chose (magnitude, downward) | mm | magnitude | 2 % or 0.05 mm, whichever is larger |
| 3 | Mid-span deflection divided by the deflection limit (span / 360) | none (a ratio) | magnitude | 2 % or 0.005, whichever is larger |
| 4 | Maximum bending stress in the beam with the section you chose, M / W (magnitude) | MPa | magnitude | 1 % or 0.5 MPa, whichever is larger |

Written justification: In four to six sentences: name the section you chose; give its mid-span deflection and the limit in mm; show that the next lighter section of the list does not meet the limit; give the bending stress as a fraction of the yield strength; and say which of the two, deflection or stress, decides the choice for this beam.

### Design requirements

| Requirement | Limit as data | Reference design | Verdict |
| --- | --- | --- | --- |
| The deflection at mid-span (node C) under the given load must not exceed the span divided by 360: 7 m / 360 = 19.4 mm. | deflection uz at node C ≤ 7 m / 360 = 19.44 mm | 16.44 mm against 19.44 mm (ratio 0.845) | met |

### Rubric

| Criterion | Weight | Assessed from | Not shown | Developing | Proficient | Exemplary |
| --- | --- | --- | --- | --- | --- | --- |
| Section choice | 35 % | model, results | The beam still has the starting section I 300x150, or the two members have different sections. | One section is assigned to both members, but its mid-span deflection exceeds the limit of 7 m / 360 = 19.4 mm (I 330x160 or I 360x170). | The chosen section meets the deflection limit but is not the lightest of the list that does (I 450x190 or I 500x200). | The chosen section is I 400x180, the lightest section of the list that meets the deflection limit. |
| Reported results | 20 % | answers, results | No answers are given, or none of the three (maximum moment, deflection, deflection ratio) is within tolerance of the value computed for the section the learner chose. | One of the three is within tolerance of the value computed for the chosen section. | Two of the three are within tolerance of the values computed for the chosen section. | All three are within tolerance of the values computed for the chosen section. |
| Stress check | 15 % | answers, results, justification | No bending stress is reported. | A bending stress is reported, but it is not M / W for the chosen section within tolerance (for example W taken from another section, or kN/m² typed as MPa). | The reported stress is M / W for the chosen section within tolerance. | As proficient, and the justification states the stress as a fraction of the yield strength of 355 MPa. |
| Justification of the choice | 30 % | justification | No justification is written, or it does not name a section. | A section is named, but the choice is not supported by numbers: the deflection or the limit (7 m / 360 = 19.4 mm) is missing. | The deflection of the chosen section and the limit are stated in mm, and they show that the chosen section meets the limit. | As proficient, and the justification shows with its deflection that the next lighter section of the list exceeds the limit, and says, with the stress value, which of deflection and stress decides the choice. |

### Reference answers

Computed by the solver from the reference model below; none of these numbers is typed in.

- Nodes (x, y, z in m): A (0, 0, 0), C (3.5, 0, 0), B (7, 0, 0).
- Members: AC from A to C (frame, I 400x180); CB from C to B (frame, I 400x180).
- Supports: A holds ux, uy, uz, rx; B holds uy, uz.
- Loads: 25 kN/m on member AC along global −Z (LC1); 25 kN/m on member CB along global −Z (LC1).

| No. | Answer | Reference value | Unit |
| --- | --- | --- | --- |
| 1 | Maximum bending moment in the beam, at mid-span (magnitude) | 153.13 | kN·m |
| 2 | Deflection at mid-span, node C, with the section you chose (magnitude, downward) | 16.44 | mm |
| 3 | Mid-span deflection divided by the deflection limit (span / 360) | 0.845 | none (a ratio) |
| 4 | Maximum bending stress in the beam with the section you chose, M / W (magnitude) | PENDING: no reference value yet (waits for pitch cards S8 and T6) | MPa |

Each section of the list, tried on the reference model:

| Section | Mass, kg/m | Design requirement | Verdict | Reference choice |
| --- | --- | --- | --- | --- |
| I 300x150 | 41.2 | 45.68 mm against 19.44 mm (ratio 2.349) | does NOT meet the requirement |  |
| I 330x160 | 49.4 | 32.02 mm against 19.44 mm (ratio 1.647) | does NOT meet the requirement |  |
| I 360x170 | 55.7 | 23.56 mm against 19.44 mm (ratio 1.212) | does NOT meet the requirement |  |
| I 400x180 | 65.8 | 16.44 mm against 19.44 mm (ratio 0.845) | meets the requirement | yes |
| I 450x190 | 74.4 | 11.44 mm against 19.44 mm (ratio 0.588) | meets the requirement |  |
| I 500x200 | 87.0 | 8.08 mm against 19.44 mm (ratio 0.416) | meets the requirement |  |

## Appendix. The generic I-sections

The sections are generic shapes defined for these tasks: two flanges and a web as three rectangles, with no root fillets. They are not taken from any manufacturer's or standard's table, and a name such as I 300x150 only says that the shape is 300 mm deep and 150 mm wide. With h the depth, b the flange width, tw the web thickness and tf the flange thickness:

- A = 2·b·tf + (h − 2·tf)·tw
- Iy = [b·h³ − (b − tw)·(h − 2·tf)³] / 12 (strong axis)
- Iz = [2·tf·b³ + (h − 2·tf)·tw³] / 12 (weak axis)
- J = [2·b·tf³ + (h − tf)·tw³] / 3 (thin-walled approximation, the web taken between the flange centre lines)
- Mass per metre = A × 7850 kg/m³

| Section | h, mm | b, mm | tw, mm | tf, mm | A, mm² | Iy, 10⁶ mm⁴ | Iz, 10⁶ mm⁴ | J, 10³ mm⁴ | Mass, kg/m |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| I 200x100 | 200 | 100 | 6 | 9 | 2892 | 19.44 | 1.50 | 62.4 | 22.7 |
| I 240x120 | 240 | 120 | 6 | 10 | 3720 | 37.08 | 2.88 | 96.6 | 29.2 |
| I 270x135 | 270 | 135 | 7 | 10 | 4450 | 54.77 | 4.11 | 119.7 | 34.9 |
| I 300x150 | 300 | 150 | 7 | 11 | 5246 | 81.47 | 6.20 | 166.1 | 41.2 |
| I 330x160 | 330 | 160 | 8 | 12 | 6288 | 116.23 | 8.21 | 238.6 | 49.4 |
| I 360x170 | 360 | 170 | 8 | 13 | 7092 | 157.95 | 10.66 | 308.2 | 55.7 |
| I 400x180 | 400 | 180 | 9 | 14 | 8388 | 226.43 | 13.63 | 423.1 | 65.8 |
| I 450x190 | 450 | 190 | 9 | 15 | 9480 | 325.32 | 17.17 | 533.2 | 74.4 |
| I 500x200 | 500 | 200 | 10 | 16 | 11080 | 460.37 | 21.37 | 707.5 | 87.0 |
| I 550x210 | 550 | 210 | 11 | 17 | 12816 | 633.21 | 26.30 | 924.3 | 100.6 |
| I 600x220 | 600 | 220 | 12 | 19 | 15104 | 883.26 | 33.80 | 1340.6 | 118.6 |

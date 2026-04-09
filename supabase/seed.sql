-- =============================================================================
-- CrewBooks — Seed Data
-- Realistic test data for Lone Star Roofing Co. (Austin, TX)
--
-- !! REPLACE THIS WITH YOUR ACTUAL AUTH USER ID !!
-- After signing up, find your user ID in:
--   Supabase Dashboard → Authentication → Users → copy the UUID
-- Then replace every occurrence of '290f086f-5b9b-4ed6-a367-6d45351232d7'
-- =============================================================================

-- Convenience variable — change this one line only
DO $$
BEGIN
  -- Validation: remind developer to replace placeholder
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '290f086f-5b9b-4ed6-a367-6d45351232d7') THEN
    RAISE NOTICE 'Auth user 290f086f-5b9b-4ed6-a367-6d45351232d7 not found — seed data will still insert but foreign key to auth.users will fail unless you replace the placeholder UUID.';
  END IF;
END $$;


-- =============================================================================
-- BUSINESS
-- =============================================================================
INSERT INTO businesses (id, owner_id, name, trade, phone, email, address, subscription_status)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  '290f086f-5b9b-4ed6-a367-6d45351232d7',
  'Lone Star Roofing Co.',
  'roofing',
  '(512) 555-0100',
  'info@lonestarroofing.example',
  '4400 N Interstate 35, Austin, TX 78722',
  'trial'
)
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- CUSTOMERS  (8 — mix of residential and commercial, Austin TX)
-- =============================================================================
INSERT INTO customers (id, business_id, name, phone, email, address, city, state, zip, source, tags, notes)
VALUES

-- 1: Residential, referral, repeat customer
(
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Mike Torres',
  '(512) 555-0112',
  'mike.torres@email.example',
  '4821 Shoal Creek Blvd',
  'Austin', 'TX', '78756',
  'referral',
  ARRAY['repeat','residential'],
  'Referred by neighbor on same block. Prefers morning appointments.'
),

-- 2: Residential, google
(
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'Sandra Webb',
  '(512) 555-0187',
  'swebb@email.example',
  '2309 Barton Springs Rd',
  'Austin', 'TX', '78704',
  'google',
  ARRAY['residential'],
  'Found us via Google. Large 2-story home. Coordinating with insurance claim.'
),

-- 3: Commercial, referral
(
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'Austin Hardware Supply',
  '(512) 555-0143',
  'facilities@austinhardware.example',
  '6100 N Lamar Blvd',
  'Austin', 'TX', '78752',
  'referral',
  ARRAY['commercial','repeat'],
  'Warehouse facility. Contact: Tom Brewer (facilities mgr). Prefers work on weekends to avoid business disruption.'
),

-- 4: Residential, door-knock
(
  '20000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  'David Kim',
  '(512) 555-0168',
  'dkim@email.example',
  '1502 Enfield Rd',
  'Austin', 'TX', '78703',
  'door-knock',
  ARRAY['residential'],
  'Original job fell through — homeowner changed scope. Keep in pipeline.'
),

-- 5: Residential, google
(
  '20000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  'Patricia Navarro',
  '(512) 555-0131',
  'pnavarro@email.example',
  '3417 Guadalupe St',
  'Austin', 'TX', '78705',
  'google',
  ARRAY['residential'],
  'Hail damage from March storm. Insurance approved full replacement.'
),

-- 6: Commercial, referral
(
  '20000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000001',
  'Hill Country Storage LLC',
  '(512) 555-0174',
  'ops@hillcountrystorage.example',
  '8900 Research Blvd',
  'Austin', 'TX', '78758',
  'referral',
  ARRAY['commercial'],
  'Multi-unit storage facility. Unit C roof had active leak. Manager: Lisa Park.'
),

-- 7: Residential, referral, repeat
(
  '20000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000001',
  'Robert Okafor',
  '(512) 555-0156',
  'rokafor@email.example',
  '712 W 6th St',
  'Austin', 'TX', '78701',
  'referral',
  ARRAY['residential','repeat'],
  'Previous job: gutters 2024. Now needs garage roof. Very communicative.'
),

-- 8: Residential, door-knock
(
  '20000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000001',
  'Jennifer Castillo',
  '(512) 555-0192',
  'jcastillo@email.example',
  '5234 Manchaca Rd',
  'Austin', 'TX', '78745',
  'door-knock',
  ARRAY['residential'],
  'Noticed ridge cap damage while in the neighborhood. Quick turnaround job.'
)

ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- JOBS  (12 — 3 scheduled, 2 in_progress, 5 completed, 2 cancelled)
-- =============================================================================
INSERT INTO jobs (
  id, business_id, customer_id,
  title, description, status, priority,
  scheduled_date, scheduled_time,
  completed_date,
  estimated_amount, actual_amount,
  notes
)
VALUES

-- ── SCHEDULED (next 2 weeks from 2026-04-08) ─────────────────────────────────

-- j1: Mike Torres — big tear-off
(
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Full tear-off and re-deck — 2,800 sq ft',
  'Complete tear-off of 20-year-old 3-tab shingles. Install new decking where rotted, synthetic underlayment, and architectural shingles. Includes drip edge, flashing, and ridge vent.',
  'scheduled', 'high',
  '2026-04-14', '07:30',
  NULL,
  12500.00, NULL,
  'Deposit invoice sent. Dumpster delivery confirmed for 4/13.'
),

-- j2: David Kim — gutters
(
  '30000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000004',
  'Gutter installation — 180 linear ft',
  'Remove old aluminum gutters. Install 6-inch K-style seamless aluminum gutters with leaf guards. Includes 4 downspouts.',
  'scheduled', 'normal',
  '2026-04-18', '08:00',
  NULL,
  2200.00, NULL,
  'Homeowner requested bronze color to match fascia.'
),

-- j3: Robert Okafor — inspection
(
  '30000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000007',
  'Storm damage inspection — detached garage',
  'Post-storm inspection of detached garage roof. Check for hail dents on vents, missing shingles, and flashing separation.',
  'scheduled', 'normal',
  '2026-04-22', '09:00',
  NULL,
  350.00, NULL,
  'Will quote full garage re-roof if damage warrants it.'
),

-- ── IN PROGRESS ───────────────────────────────────────────────────────────────

-- j4: Sandra Webb — active shingle job
(
  '30000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'Architectural shingle replacement — 3,200 sq ft',
  'Full tear-off. Decking inspection (some soft spots expected). Synthetic underlayment, ice-and-water shield at eaves, Owens Corning Duration shingles in Estate Gray.',
  'in_progress', 'high',
  '2026-04-05', '07:00',
  NULL,
  8400.00, NULL,
  'Day 2 of 3. Decking replacement added ~$200 in materials — updating estimate.'
),

-- j5: Austin Hardware Supply — commercial re-coat
(
  '30000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000003',
  'Commercial flat roof re-coat — 4,000 sq ft',
  'Pressure wash, prime, and apply two coats of elastomeric roof coating to main warehouse flat roof. Repair seams and reseal all penetrations.',
  'in_progress', 'normal',
  '2026-04-07', '06:30',
  NULL,
  6800.00, NULL,
  'First coat applied. Second coat scheduled for 4/9 after overnight cure.'
),

-- ── COMPLETED (past 30 days) ──────────────────────────────────────────────────

-- j6: Mike Torres — garage patch (completed)
(
  '30000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Flat roof patch — garage addition',
  'Repair 40 sq ft blister and crack on modified-bitumen garage roof. Apply two-coat patch with fibered coating.',
  'completed', 'normal',
  '2026-03-15', '08:00',
  '2026-03-15 14:30:00+00',
  1200.00, 1150.00,
  'Completed same day. Minor material savings — no decking replacement needed.'
),

-- j7: Patricia Navarro — insurance replacement (completed)
(
  '30000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000005',
  '3-tab shingle replacement — 2,800 sq ft (insurance)',
  'Full tear-off and replacement per insurance scope. 28 squares of Certainteed XT-25 shingles, synthetic felt, new drip edge.',
  'completed', 'high',
  '2026-03-20', '07:00',
  '2026-03-21 16:00:00+00',
  7500.00, 7200.00,
  'Two-day job. Insurance paid direct — collect balance from homeowner.'
),

-- j8: Hill Country Storage — TPO repair (completed)
(
  '30000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000006',
  'TPO membrane repair — Unit C roof',
  'Repair 200 sq ft failed TPO membrane section above Unit C. Replace wet insulation board, install new TPO patch and heat-weld seams.',
  'completed', 'urgent',
  '2026-03-25', '07:00',
  '2026-03-25 15:00:00+00',
  4500.00, 4200.00,
  'Active leak stopped. Recommend full TPO replacement within 2 years.'
),

-- j9: Sandra Webb — inspection (completed)
(
  '30000000-0000-0000-0000-000000000009',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  'Storm damage inspection and report',
  'Post-hail inspection. Photo documentation of all damage. Written report for insurance adjuster.',
  'completed', 'normal',
  '2026-03-28', '10:00',
  '2026-03-28 12:00:00+00',
  350.00, 300.00,
  'Damage confirmed on 28 squares. Handed off to insurance — led to j4 shingle job.'
),

-- j10: Jennifer Castillo — ridge cap (completed)
(
  '30000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000008',
  'Ridge cap and flashing replacement',
  'Remove and replace blown-off ridge cap (approx 60 LF). Re-bed and seal all step flashing along dormers.',
  'completed', 'normal',
  '2026-04-03', '08:00',
  '2026-04-03 13:00:00+00',
  900.00, 850.00,
  'Half-day job. Customer very happy — left 5-star Google review.'
),

-- ── CANCELLED ─────────────────────────────────────────────────────────────────

-- j11: David Kim — big job cancelled
(
  '30000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000004',
  'Full tear-off and re-deck — 3,100 sq ft',
  'Full replacement quoted. Customer decided to sell house instead.',
  'cancelled', 'normal',
  '2026-03-10', NULL,
  NULL,
  13500.00, NULL,
  'Customer put house on market. May resurface with buyer as new customer.'
),

-- j12: Robert Okafor — garage roof cancelled
(
  '30000000-0000-0000-0000-000000000012',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000007',
  'Flat roof installation — detached garage',
  'Convert shed-style garage roof to low-slope TPO. Homeowner paused project pending permit approval.',
  'cancelled', 'low',
  '2026-03-05', NULL,
  NULL,
  3200.00, NULL,
  'City permit denied — wrong zone classification. Customer may reapply in 60 days.'
)

ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- INVOICES  (8 — 2 draft, 2 sent, 3 paid, 1 overdue)
-- note: tax_amount and total are GENERATED columns — do not insert them
-- =============================================================================
INSERT INTO invoices (
  id, business_id, customer_id, job_id,
  invoice_number,
  amount, tax_rate,
  status,
  due_date, paid_date,
  notes, line_items
)
VALUES

-- ── PAID ──────────────────────────────────────────────────────────────────────

-- inv1: Mike Torres — garage patch (PAID)
(
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000006',
  'INV-0001',
  1150.00, 0.0825,
  'paid',
  '2026-04-01', '2026-03-18 10:22:00+00',
  'Paid via check day of completion.',
  '[
    {"description": "Modified bitumen patch materials (40 sq ft)", "quantity": 40, "unit_price": 12.50, "amount": 500.00},
    {"description": "Labor — flat roof patch and seal", "quantity": 4, "unit_price": 125.00, "amount": 500.00},
    {"description": "Elastomeric roof coating (2 gal)", "quantity": 2, "unit_price": 75.00, "amount": 150.00}
  ]'
),

-- inv2: Jennifer Castillo — ridge cap (PAID)
(
  '40000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000008',
  '30000000-0000-0000-0000-000000000010',
  'INV-0002',
  850.00, 0.0825,
  'paid',
  '2026-04-17', '2026-04-04 09:15:00+00',
  'Paid via Stripe payment link same week.',
  '[
    {"description": "Ridge cap shingles — 3-tab (2 bundles)", "quantity": 2, "unit_price": 85.00, "amount": 170.00},
    {"description": "Labor — remove and replace ridge cap (60 LF)", "quantity": 4, "unit_price": 110.00, "amount": 440.00},
    {"description": "Roofing nails, sealant, and step flashing", "quantity": 1, "unit_price": 240.00, "amount": 240.00}
  ]'
),

-- inv3: Sandra Webb — storm inspection (PAID)
(
  '40000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000009',
  'INV-0003',
  300.00, 0.0825,
  'paid',
  '2026-04-11', '2026-03-30 14:05:00+00',
  'Storm inspection fee. Waived remainder as goodwill toward full shingle job.',
  '[
    {"description": "Storm damage inspection and written report", "quantity": 1, "unit_price": 300.00, "amount": 300.00}
  ]'
),

-- ── SENT ──────────────────────────────────────────────────────────────────────

-- inv4: Patricia Navarro — full shingle replacement (SENT)
(
  '40000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000005',
  '30000000-0000-0000-0000-000000000007',
  'INV-0004',
  7200.00, 0.0825,
  'sent',
  '2026-04-07', NULL,
  'Sent via email 3/22. Insurance paid $6,100 direct — customer owes $1,100 balance.',
  '[
    {"description": "Tear-off existing shingles (28 squares)", "quantity": 28, "unit_price": 45.00, "amount": 1260.00},
    {"description": "30-lb felt underlayment (28 squares)", "quantity": 28, "unit_price": 18.00, "amount": 504.00},
    {"description": "CertainTeed XT-25 shingles — installed (28 squares)", "quantity": 28, "unit_price": 155.00, "amount": 4340.00},
    {"description": "Aluminum drip edge — 180 LF", "quantity": 180, "unit_price": 3.00, "amount": 540.00},
    {"description": "Roof-to-wall step flashing", "quantity": 1, "unit_price": 280.00, "amount": 280.00},
    {"description": "Dumpster rental and debris haul-off", "quantity": 1, "unit_price": 276.00, "amount": 276.00}
  ]'
),

-- inv5: Mike Torres — 50% deposit for j1 (SENT)
(
  '40000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'INV-0005',
  2500.00, 0.0825,
  'sent',
  '2026-04-12', NULL,
  '50% deposit due before work begins on 4/14. Balance due on completion.',
  '[
    {"description": "50% deposit — full tear-off and re-deck (2,800 sq ft)", "quantity": 1, "unit_price": 2500.00, "amount": 2500.00}
  ]'
),

-- ── OVERDUE ───────────────────────────────────────────────────────────────────

-- inv6: Hill Country Storage — TPO repair (OVERDUE)
(
  '40000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000006',
  '30000000-0000-0000-0000-000000000008',
  'INV-0006',
  4200.00, 0.0825,
  'overdue',
  '2026-03-31', NULL,
  'Net-30 terms. Past due as of 4/1. Second reminder sent 4/5 — no response.',
  '[
    {"description": "TPO membrane patch (200 sq ft)", "quantity": 200, "unit_price": 8.50, "amount": 1700.00},
    {"description": "Labor — tear-out and re-membrane", "quantity": 12, "unit_price": 125.00, "amount": 1500.00},
    {"description": "Polyiso insulation board replacement (4 sheets)", "quantity": 4, "unit_price": 175.00, "amount": 700.00},
    {"description": "TPO sealant, fasteners, and termination bar", "quantity": 1, "unit_price": 300.00, "amount": 300.00}
  ]'
),

-- ── DRAFT ─────────────────────────────────────────────────────────────────────

-- inv7: Sandra Webb — shingle replacement in progress (DRAFT)
(
  '40000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000004',
  'INV-0007',
  8400.00, 0.0825,
  'draft',
  '2026-04-22', NULL,
  'Draft — will finalize and send on job completion. May adjust for extra decking.',
  '[
    {"description": "Tear-off existing shingles (32 squares)", "quantity": 32, "unit_price": 45.00, "amount": 1440.00},
    {"description": "Synthetic felt underlayment (32 squares)", "quantity": 32, "unit_price": 20.00, "amount": 640.00},
    {"description": "Owens Corning Duration shingles — installed (32 squares)", "quantity": 32, "unit_price": 165.00, "amount": 5280.00},
    {"description": "Drip edge and step flashing", "quantity": 1, "unit_price": 340.00, "amount": 340.00},
    {"description": "Dumpster rental and haul-off", "quantity": 1, "unit_price": 300.00, "amount": 300.00},
    {"description": "City permit fee", "quantity": 1, "unit_price": 400.00, "amount": 400.00}
  ]'
),

-- inv8: Austin Hardware Supply — flat roof re-coat in progress (DRAFT)
(
  '40000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000005',
  'INV-0008',
  6800.00, 0.0825,
  'draft',
  '2026-04-21', NULL,
  'Draft — send upon coating inspection sign-off.',
  '[
    {"description": "Pressure wash and surface prep (4,000 sq ft)", "quantity": 4000, "unit_price": 0.20, "amount": 800.00},
    {"description": "Commercial-grade primer coat (4,000 sq ft)", "quantity": 4000, "unit_price": 0.30, "amount": 1200.00},
    {"description": "Elastomeric coating — 2 coats (4,000 sq ft)", "quantity": 4000, "unit_price": 0.85, "amount": 3400.00},
    {"description": "Flashing repair and penetration reseal", "quantity": 1, "unit_price": 600.00, "amount": 600.00},
    {"description": "Seam reinforcement tape (200 LF)", "quantity": 200, "unit_price": 4.00, "amount": 800.00}
  ]'
)

ON CONFLICT (id) DO NOTHING;

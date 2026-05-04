UPDATE public.tap_charges
SET status = 'cancelled',
    error_message = COALESCE(error_message, 'Charge ABANDONED on Tap (user did not complete 3DS) — auto-reconciled')
WHERE charge_id IN (
  'chg_LV04G0920261608Rn5u0405825',
  'chg_LV06G3520261445Hb2p0405183',
  'chg_LV07G2920261436Mq9b0405834',
  'chg_TS01A4420261010Ky4b0405172',
  'chg_LV05G1320262113Hm470305905',
  'chg_LV04G5420262109Ki7m0305679',
  'chg_LV06G0320262109Tq7x0305430'
)
AND status NOT IN ('succeeded','cancelled','failed');
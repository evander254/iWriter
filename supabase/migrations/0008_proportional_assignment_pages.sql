-- Page totals are proportional to word count (300 words = 1 page), so retain
-- fractional pages rather than rounding every assignment up to a whole page.
alter table public.assignments
  alter column pages type numeric(8, 2)
  using round(pages::numeric, 2);

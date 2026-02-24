ALTER TABLE cost_data_cache
  ADD COLUMN forecast_total numeric,
  ADD COLUMN forecast_period_start date,
  ADD COLUMN forecast_period_end date,
  ADD COLUMN forecast_data jsonb;
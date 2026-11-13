-- INDEXES
CREATE INDEX idx_customers_name ON customers(full_name);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_products_name ON products(product_name);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_orders_status ON sales_orders(status);
CREATE INDEX idx_orders_created ON sales_orders(created_at);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
USE aquamuna_salesandcrm_schema;

-- =====================================================
-- PRIMARY KEYS
-- =====================================================

ALTER TABLE users
ADD PRIMARY KEY (user_id);

ALTER TABLE branches
ADD PRIMARY KEY (branch_id);

ALTER TABLE customers
ADD PRIMARY KEY (customer_id);

ALTER TABLE customer_containers
ADD PRIMARY KEY (container_id);

ALTER TABLE products
ADD PRIMARY KEY (product_id);

ALTER TABLE quotations
ADD PRIMARY KEY (quotation_id);

ALTER TABLE quotation_items
ADD PRIMARY KEY (quotation_item_id);

ALTER TABLE sales_orders
ADD PRIMARY KEY (order_id);

ALTER TABLE sales_order_items
ADD PRIMARY KEY (sales_order_item_id);

ALTER TABLE deliveries
ADD PRIMARY KEY (delivery_id);

ALTER TABLE delivery_incidents
ADD PRIMARY KEY (incident_id);

ALTER TABLE delivery_receipts
ADD PRIMARY KEY (delivery_receipt_id);

ALTER TABLE payments
ADD PRIMARY KEY (payment_id);

ALTER TABLE official_receipts
ADD PRIMARY KEY (official_receipt_id);

ALTER TABLE returns
ADD PRIMARY KEY (return_id);

ALTER TABLE activity_logs
ADD PRIMARY KEY (log_id);

-- =====================================================
-- AUTO_INCREMENT
-- =====================================================

ALTER TABLE users
MODIFY user_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE branches
MODIFY branch_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE customers
MODIFY customer_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE customer_containers
MODIFY container_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE products
MODIFY product_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE quotations
MODIFY quotation_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE quotation_items
MODIFY quotation_item_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE sales_orders
MODIFY order_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE sales_order_items
MODIFY sales_order_item_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE deliveries
MODIFY delivery_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE delivery_incidents
MODIFY incident_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE delivery_receipts
MODIFY delivery_receipt_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE payments
MODIFY payment_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE official_receipts
MODIFY official_receipt_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE returns
MODIFY return_id INT NOT NULL AUTO_INCREMENT;

ALTER TABLE activity_logs
MODIFY log_id INT NOT NULL AUTO_INCREMENT;

-- =====================================================
-- UNIQUE KEYS
-- =====================================================

ALTER TABLE users
ADD UNIQUE KEY uk_users_username (username);

ALTER TABLE users
ADD UNIQUE KEY uk_users_email (email);

ALTER TABLE branches
ADD UNIQUE KEY uk_branches_name (branch_name);

ALTER TABLE customers
ADD UNIQUE KEY uk_customers_code (customer_code);

ALTER TABLE customers
ADD UNIQUE KEY uk_customers_email (email);

ALTER TABLE products
ADD UNIQUE KEY uk_products_sku (sku);

ALTER TABLE quotations
ADD UNIQUE KEY uk_quotation_no (quotation_no);

ALTER TABLE sales_orders
ADD UNIQUE KEY uk_order_no (order_no);

ALTER TABLE deliveries
ADD UNIQUE KEY uk_delivery_no (delivery_no);

ALTER TABLE payments
ADD UNIQUE KEY uk_payment_no (payment_no);

ALTER TABLE official_receipts
ADD UNIQUE KEY uk_receipt_no (receipt_no);

ALTER TABLE returns
ADD UNIQUE KEY uk_return_no (return_no);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

CREATE INDEX idx_customer_name
ON customers(full_name);

CREATE INDEX idx_customer_branch
ON customers(branch_id);

CREATE INDEX idx_products_branch
ON products(branch_id);

CREATE INDEX idx_order_customer
ON sales_orders(customer_id);

CREATE INDEX idx_order_quote
ON sales_orders(quotation_id);

CREATE INDEX idx_quote_customer
ON quotations(customer_id);

CREATE INDEX idx_delivery_order
ON deliveries(order_id);

CREATE INDEX idx_incident_delivery
ON delivery_incidents(delivery_id);

CREATE INDEX idx_delivery_receipt_delivery
ON delivery_receipts(delivery_id);

CREATE INDEX idx_payment_customer
ON payments(customer_id);

CREATE INDEX idx_payment_order
ON payments(order_id);

CREATE INDEX idx_or_payment
ON official_receipts(payment_id);

CREATE INDEX idx_return_order
ON returns(order_id);

CREATE INDEX idx_qitem_quote
ON quotation_items(quotation_id);

CREATE INDEX idx_qitem_product
ON quotation_items(product_id);

CREATE INDEX idx_soitem_order
ON sales_order_items(order_id);

CREATE INDEX idx_soitem_product
ON sales_order_items(product_id);

CREATE INDEX idx_log_user
ON activity_logs(user_id);

CREATE INDEX idx_log_module
ON activity_logs(module_name);

CREATE INDEX idx_log_record
ON activity_logs(record_type, record_id);

-- =====================================================
-- FOREIGN KEYS
-- =====================================================

ALTER TABLE customers
ADD CONSTRAINT fk_customer_branch
FOREIGN KEY (branch_id)
REFERENCES branches(branch_id);

ALTER TABLE customer_containers
ADD CONSTRAINT fk_container_customer
FOREIGN KEY (customer_id)
REFERENCES customers(customer_id)
ON DELETE CASCADE;

ALTER TABLE products
ADD CONSTRAINT fk_product_branch
FOREIGN KEY (branch_id)
REFERENCES branches(branch_id);

ALTER TABLE quotations
ADD CONSTRAINT fk_quote_customer
FOREIGN KEY (customer_id)
REFERENCES customers(customer_id);

ALTER TABLE quotation_items
ADD CONSTRAINT fk_quoteitem_quote
FOREIGN KEY (quotation_id)
REFERENCES quotations(quotation_id)
ON DELETE CASCADE;

ALTER TABLE quotation_items
ADD CONSTRAINT fk_quoteitem_product
FOREIGN KEY (product_id)
REFERENCES products(product_id);

ALTER TABLE sales_orders
ADD CONSTRAINT fk_order_customer
FOREIGN KEY (customer_id)
REFERENCES customers(customer_id);

ALTER TABLE sales_orders
ADD CONSTRAINT fk_order_quote
FOREIGN KEY (quotation_id)
REFERENCES quotations(quotation_id);

ALTER TABLE sales_order_items
ADD CONSTRAINT fk_orderitem_order
FOREIGN KEY (order_id)
REFERENCES sales_orders(order_id)
ON DELETE CASCADE;

ALTER TABLE sales_order_items
ADD CONSTRAINT fk_orderitem_product
FOREIGN KEY (product_id)
REFERENCES products(product_id);

ALTER TABLE deliveries
ADD CONSTRAINT fk_delivery_order
FOREIGN KEY (order_id)
REFERENCES sales_orders(order_id);

ALTER TABLE delivery_incidents
ADD CONSTRAINT fk_incident_delivery
FOREIGN KEY (delivery_id)
REFERENCES deliveries(delivery_id);

ALTER TABLE delivery_receipts
ADD CONSTRAINT fk_delivery_receipt
FOREIGN KEY (delivery_id)
REFERENCES deliveries(delivery_id);

ALTER TABLE payments
ADD CONSTRAINT fk_payment_customer
FOREIGN KEY (customer_id)
REFERENCES customers(customer_id);

ALTER TABLE payments
ADD CONSTRAINT fk_payment_order
FOREIGN KEY (order_id)
REFERENCES sales_orders(order_id);

ALTER TABLE official_receipts
ADD CONSTRAINT fk_or_payment
FOREIGN KEY (payment_id)
REFERENCES payments(payment_id);

ALTER TABLE returns
ADD CONSTRAINT fk_return_order
FOREIGN KEY (order_id)
REFERENCES sales_orders(order_id);

ALTER TABLE activity_logs
ADD CONSTRAINT fk_log_user
FOREIGN KEY (user_id)
REFERENCES users(user_id);

-- =====================================================
-- END 
-- =====================================================
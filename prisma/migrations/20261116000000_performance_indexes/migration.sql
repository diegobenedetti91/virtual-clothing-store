-- Índices para listagens rápidas com muitos produtos/pedidos
CREATE INDEX `Product_active_createdAt_idx` ON `Product`(`active`, `createdAt`);
CREATE INDEX `Product_active_price_idx` ON `Product`(`active`, `price`);
CREATE INDEX `Product_active_name_idx` ON `Product`(`active`, `name`);
CREATE INDEX `Order_status_createdAt_idx` ON `Order`(`status`, `createdAt`);
CREATE INDEX `Order_createdAt_idx` ON `Order`(`createdAt`);
CREATE INDEX `Order_customerEmail_idx` ON `Order`(`customerEmail`);

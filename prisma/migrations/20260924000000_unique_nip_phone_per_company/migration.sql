-- CreateIndex
CREATE UNIQUE INDEX `users_company_id_nip_key` ON `users`(`company_id`, `nip`);

-- CreateIndex
CREATE UNIQUE INDEX `users_company_id_phone_key` ON `users`(`company_id`, `phone`);

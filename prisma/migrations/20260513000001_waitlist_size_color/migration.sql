-- Columns size/color were already added by the first (partially-executed) migration attempt.
-- Only the index operations remain: create new index first, then drop the old one.
ALTER TABLE `WaitlistEntry` ADD UNIQUE INDEX `WaitlistEntry_productId_email_size_color_key` (`productId`, `email`, `size`, `color`);
ALTER TABLE `WaitlistEntry` DROP INDEX `WaitlistEntry_productId_email_key`;

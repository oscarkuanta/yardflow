-- CreateTable
CREATE TABLE `Company` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contactEmail` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Company_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'PLANNER', 'GATE_OPERATOR', 'CUSTOMER') NOT NULL,
    `companyId` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Block` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(2) NOT NULL,
    `type` ENUM('STANDARD', 'EMPTY', 'DG') NOT NULL,
    `sizeClass` ENUM('SMALL', 'LARGE') NOT NULL,
    `rows` INTEGER NOT NULL,
    `bays` INTEGER NOT NULL,
    `maxTier` INTEGER NOT NULL,
    `mapX` INTEGER NOT NULL,
    `mapY` INTEGER NOT NULL,
    `gateDistanceM` INTEGER NOT NULL,

    UNIQUE INDEX `Block_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Container` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(11) NOT NULL,
    `size` ENUM('FT20', 'FT40', 'FT45') NOT NULL,
    `isHighCube` BOOLEAN NOT NULL DEFAULT false,
    `loadStatus` ENUM('FULL', 'EMPTY') NOT NULL,
    `isDangerous` BOOLEAN NOT NULL DEFAULT false,
    `imoClass` VARCHAR(4) NULL,
    `grossWeightKg` INTEGER NULL,
    `ownerCompanyId` INTEGER NOT NULL,
    `state` ENUM('EXPECTED', 'IN_YARD', 'DEPARTED') NOT NULL DEFAULT 'EXPECTED',
    `gateInAt` DATETIME(3) NULL,
    `departedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Container_number_key`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContainerPosition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `containerId` INTEGER NOT NULL,
    `blockId` INTEGER NOT NULL,
    `row` INTEGER NOT NULL,
    `bay` INTEGER NOT NULL,
    `tier` INTEGER NOT NULL,

    UNIQUE INDEX `ContainerPosition_containerId_key`(`containerId`),
    INDEX `ContainerPosition_blockId_row_bay_idx`(`blockId`, `row`, `bay`),
    UNIQUE INDEX `ContainerPosition_blockId_row_bay_tier_key`(`blockId`, `row`, `bay`, `tier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Movement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `containerId` INTEGER NOT NULL,
    `type` ENUM('GATE_IN', 'GATE_OUT', 'DISCHARGE', 'LOAD', 'YARD_MOVE', 'RELOCATION') NOT NULL,
    `fromPosition` VARCHAR(16) NULL,
    `toPosition` VARCHAR(16) NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Movement_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `containerId` INTEGER NOT NULL,
    `fromPosition` VARCHAR(16) NOT NULL,
    `toPosition` VARCHAR(16) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `groupKey` VARCHAR(36) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    `completedById` INTEGER NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkOrder_groupKey_idx`(`groupKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VesselVisit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vesselName` VARCHAR(191) NOT NULL,
    `imoNumber` VARCHAR(7) NOT NULL,
    `voyage` VARCHAR(10) NOT NULL,
    `eta` DATETIME(3) NOT NULL,
    `etd` DATETIME(3) NOT NULL,
    `ata` DATETIME(3) NULL,
    `atd` DATETIME(3) NULL,
    `status` ENUM('PLANNED', 'ARRIVED', 'WORKING', 'DEPARTED') NOT NULL DEFAULT 'PLANNED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VesselVisitItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `visitId` INTEGER NOT NULL,
    `containerNumber` VARCHAR(11) NOT NULL,
    `containerId` INTEGER NULL,
    `direction` ENUM('DISCHARGE', 'LOAD') NOT NULL,
    `size` ENUM('FT20', 'FT40', 'FT45') NOT NULL,
    `isHighCube` BOOLEAN NOT NULL DEFAULT false,
    `loadStatus` ENUM('FULL', 'EMPTY') NOT NULL,
    `isDangerous` BOOLEAN NOT NULL DEFAULT false,
    `imoClass` VARCHAR(4) NULL,
    `grossWeightKg` INTEGER NULL,
    `ownerCompanyId` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'DONE') NOT NULL DEFAULT 'PENDING',
    `doneAt` DATETIME(3) NULL,

    UNIQUE INDEX `VesselVisitItem_visitId_containerNumber_direction_key`(`visitId`, `containerNumber`, `direction`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimeSlot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `startHour` INTEGER NOT NULL,
    `capacity` INTEGER NOT NULL,

    UNIQUE INDEX `TimeSlot_date_startHour_key`(`date`, `startHour`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PreAdvice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(20) NOT NULL,
    `companyId` INTEGER NOT NULL,
    `type` ENUM('DELIVERY', 'PICKUP') NOT NULL,
    `containerNumber` VARCHAR(11) NOT NULL,
    `size` ENUM('FT20', 'FT40', 'FT45') NULL,
    `isHighCube` BOOLEAN NULL,
    `loadStatus` ENUM('FULL', 'EMPTY') NULL,
    `isDangerous` BOOLEAN NULL,
    `imoClass` VARCHAR(4) NULL,
    `grossWeightKg` INTEGER NULL,
    `truckPlate` VARCHAR(15) NOT NULL,
    `driverName` VARCHAR(191) NOT NULL,
    `pinHash` VARCHAR(191) NOT NULL,
    `timeSlotId` INTEGER NOT NULL,
    `status` ENUM('ACTIVE', 'USED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PreAdvice_reference_key`(`reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GateTransaction` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `direction` ENUM('IN', 'OUT') NOT NULL,
    `preAdviceId` INTEGER NOT NULL,
    `containerId` INTEGER NOT NULL,
    `truckPlate` VARCHAR(15) NOT NULL,
    `driverName` VARCHAR(191) NOT NULL,
    `lane` INTEGER NOT NULL,
    `operatorId` INTEGER NOT NULL,
    `noDamage` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GateTransaction_preAdviceId_key`(`preAdviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DamageReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `gateTransactionId` INTEGER NOT NULL,
    `side` ENUM('FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'FLOOR') NOT NULL,
    `code` ENUM('DENT', 'HOLE', 'RUST', 'BROKEN', 'MISSING') NOT NULL,
    `note` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomsHold` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `containerId` INTEGER NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `placedById` INTEGER NOT NULL,
    `placedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `releasedById` INTEGER NULL,
    `releasedAt` DATETIME(3) NULL,

    INDEX `CustomsHold_containerId_releasedAt_idx`(`containerId`, `releasedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StorageInvoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(20) NOT NULL,
    `containerId` INTEGER NOT NULL,
    `periodFrom` DATETIME(3) NOT NULL,
    `periodTo` DATETIME(3) NOT NULL,
    `days` INTEGER NOT NULL,
    `freeDays` INTEGER NOT NULL,
    `chargeableDays` INTEGER NOT NULL,
    `dailyRateCents` INTEGER NOT NULL,
    `amountCents` INTEGER NOT NULL,
    `status` ENUM('UNPAID', 'PAID', 'VOID') NOT NULL DEFAULT 'UNPAID',
    `paidMarkedById` INTEGER NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StorageInvoice_number_key`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tariff` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `size` ENUM('FT20', 'FT40', 'FT45') NOT NULL,
    `isDangerous` BOOLEAN NOT NULL,
    `freeDays` INTEGER NOT NULL,
    `dailyRateCents` INTEGER NOT NULL,

    UNIQUE INDEX `Tariff_size_isDangerous_key`(`size`, `isDangerous`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `companyId` INTEGER NOT NULL,
    `type` ENUM('CONTAINER_IN_YARD', 'READY_FOR_PICKUP', 'CUSTOMS_HOLD_PLACED', 'CUSTOMS_HOLD_RELEASED', 'INVOICE_ISSUED', 'INVOICE_PAID', 'GATE_OUT_DONE', 'PRE_ADVICE_EXPIRED') NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `containerNumber` VARCHAR(11) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_companyId_readAt_idx`(`companyId`, `readAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Container` ADD CONSTRAINT `Container_ownerCompanyId_fkey` FOREIGN KEY (`ownerCompanyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContainerPosition` ADD CONSTRAINT `ContainerPosition_containerId_fkey` FOREIGN KEY (`containerId`) REFERENCES `Container`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContainerPosition` ADD CONSTRAINT `ContainerPosition_blockId_fkey` FOREIGN KEY (`blockId`) REFERENCES `Block`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Movement` ADD CONSTRAINT `Movement_containerId_fkey` FOREIGN KEY (`containerId`) REFERENCES `Container`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Movement` ADD CONSTRAINT `Movement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_containerId_fkey` FOREIGN KEY (`containerId`) REFERENCES `Container`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_completedById_fkey` FOREIGN KEY (`completedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VesselVisitItem` ADD CONSTRAINT `VesselVisitItem_visitId_fkey` FOREIGN KEY (`visitId`) REFERENCES `VesselVisit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VesselVisitItem` ADD CONSTRAINT `VesselVisitItem_containerId_fkey` FOREIGN KEY (`containerId`) REFERENCES `Container`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreAdvice` ADD CONSTRAINT `PreAdvice_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreAdvice` ADD CONSTRAINT `PreAdvice_timeSlotId_fkey` FOREIGN KEY (`timeSlotId`) REFERENCES `TimeSlot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GateTransaction` ADD CONSTRAINT `GateTransaction_preAdviceId_fkey` FOREIGN KEY (`preAdviceId`) REFERENCES `PreAdvice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GateTransaction` ADD CONSTRAINT `GateTransaction_containerId_fkey` FOREIGN KEY (`containerId`) REFERENCES `Container`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GateTransaction` ADD CONSTRAINT `GateTransaction_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DamageReport` ADD CONSTRAINT `DamageReport_gateTransactionId_fkey` FOREIGN KEY (`gateTransactionId`) REFERENCES `GateTransaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomsHold` ADD CONSTRAINT `CustomsHold_containerId_fkey` FOREIGN KEY (`containerId`) REFERENCES `Container`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomsHold` ADD CONSTRAINT `CustomsHold_placedById_fkey` FOREIGN KEY (`placedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomsHold` ADD CONSTRAINT `CustomsHold_releasedById_fkey` FOREIGN KEY (`releasedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StorageInvoice` ADD CONSTRAINT `StorageInvoice_containerId_fkey` FOREIGN KEY (`containerId`) REFERENCES `Container`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StorageInvoice` ADD CONSTRAINT `StorageInvoice_paidMarkedById_fkey` FOREIGN KEY (`paidMarkedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

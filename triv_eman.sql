-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Jul 20, 2026 at 02:44 PM
-- Server version: 10.11.16-MariaDB
-- PHP Version: 8.3.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `triv_eman`
--

-- --------------------------------------------------------

--
-- Table structure for table `booking`
--

CREATE TABLE `booking` (
  `id` int(11) NOT NULL,
  `customerId` int(11) NOT NULL,
  `nakaId` int(11) NOT NULL,
  `skillId` int(11) NOT NULL,
  `workerCount` int(11) NOT NULL,
  `status` varchar(191) NOT NULL DEFAULT 'PENDING',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `amount` double DEFAULT NULL,
  `razorpayOrderId` varchar(191) DEFAULT NULL,
  `razorpayPaymentId` varchar(191) DEFAULT NULL,
  `arrivedWorkerIds` varchar(191) NOT NULL DEFAULT '[]',
  `isRated` tinyint(1) NOT NULL DEFAULT 0,
  `cancelledWorkerIds` varchar(191) NOT NULL DEFAULT '[]',
  `completedWorkerIds` text DEFAULT NULL,
  `addressId` int(11) DEFAULT NULL,
  `selectedNakaIds` text NOT NULL DEFAULT '[]'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `booking`
--

INSERT INTO `booking` (`id`, `customerId`, `nakaId`, `skillId`, `workerCount`, `status`, `createdAt`, `updatedAt`, `amount`, `razorpayOrderId`, `razorpayPaymentId`, `arrivedWorkerIds`, `isRated`, `cancelledWorkerIds`, `completedWorkerIds`, `addressId`, `selectedNakaIds`) VALUES
(1, 2, 3, 1, 1, 'CANCELLED', '2026-07-16 15:49:15.407', '2026-07-16 15:52:44.892', 900, 'order_TEEHHR5OwfCZbI', 'pay_TEEHcDdwiIOpO4', '[]', 0, '[1]', NULL, 1, '[3,9]'),
(2, 2, 3, 1, 1, 'COMPLETED', '2026-07-16 15:55:05.783', '2026-07-16 15:55:55.370', 700, 'order_TEENRuxJ9L0pSj', 'pay_TEENiritBAQOER', '[1]', 1, '[]', NULL, 1, '[3,9]'),
(3, 2, 3, 1, 1, 'COMPLETED', '2026-07-16 15:56:27.900', '2026-07-16 15:57:19.819', 900, 'order_TEEOtVfg6Jz6ty', 'pay_TEEP9nWJU52u8k', '[1]', 1, '[]', '[1]', 1, '[3,9]'),
(4, 2, 3, 1, 1, 'COMPLETED', '2026-07-16 16:14:05.032', '2026-07-16 16:15:10.224', 700, 'order_TEEhVSCbQG1YM7', 'pay_TEEhlpffgBBiDo', '[1]', 1, '[]', NULL, 1, '[3,9]'),
(5, 2, 3, 1, 1, 'COMPLETED', '2026-07-16 16:17:16.031', '2026-07-16 16:18:06.514', 700, 'order_TEEkrwTHiphqVy', 'pay_TEElHZABeNT1K2', '[1]', 1, '[]', NULL, 1, '[3,9]'),
(6, 2, 3, 1, 1, 'COMPLETED', '2026-07-20 12:41:25.449', '2026-07-20 12:42:53.714', 700, 'order_TFlDLgATEalILp', 'pay_TFlDlg51JBHYJ8', '[1]', 1, '[]', NULL, 1, '[3,9]');

-- --------------------------------------------------------

--
-- Table structure for table `bookingsetting`
--

CREATE TABLE `bookingsetting` (
  `id` int(11) NOT NULL DEFAULT 1,
  `assignmentMode` enum('AUTO','CUSTOMER_SELECT') NOT NULL DEFAULT 'AUTO',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `bookingsetting`
--

INSERT INTO `bookingsetting` (`id`, `assignmentMode`, `createdAt`, `updatedAt`) VALUES
(1, 'CUSTOMER_SELECT', '2026-07-20 11:41:04.186', '2026-07-20 12:44:38.787');

-- --------------------------------------------------------

--
-- Table structure for table `city`
--

CREATE TABLE `city` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `stateId` int(11) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `city`
--

INSERT INTO `city` (`id`, `name`, `stateId`, `createdAt`, `updatedAt`) VALUES
(1, 'Dombivli', 14, '2026-04-17 09:23:34.247', '2026-07-07 15:35:22.340'),
(2, 'Mumbai', 14, '2026-04-17 13:10:43.968', '2026-07-07 15:35:30.645'),
(3, 'Delhi', 32, '2026-07-07 15:35:40.703', '2026-07-07 15:35:40.703');

-- --------------------------------------------------------

--
-- Table structure for table `citypincode`
--

CREATE TABLE `citypincode` (
  `id` int(11) NOT NULL,
  `pincode` varchar(6) NOT NULL,
  `cityId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `conflict`
--

CREATE TABLE `conflict` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) NOT NULL,
  `raisedByType` enum('CLIENT','WORKER') NOT NULL,
  `raisedById` int(11) DEFAULT NULL,
  `customerId` int(11) DEFAULT NULL,
  `workerId` int(11) DEFAULT NULL,
  `mitraId` int(11) DEFAULT NULL,
  `reason` varchar(191) NOT NULL,
  `description` varchar(191) DEFAULT NULL,
  `penaltyAmount` int(11) DEFAULT NULL,
  `status` enum('PENDING','IN_PROGRESS','SOLVED','UNRESOLVED') NOT NULL DEFAULT 'PENDING',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `continueWork` tinyint(1) NOT NULL DEFAULT 1,
  `requestedAction` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `conflict`
--

INSERT INTO `conflict` (`id`, `bookingId`, `raisedByType`, `raisedById`, `customerId`, `workerId`, `mitraId`, `reason`, `description`, `penaltyAmount`, `status`, `createdAt`, `updatedAt`, `continueWork`, `requestedAction`) VALUES
(1, 1, 'CLIENT', 2, 2, NULL, 1, 'Worker late hai', NULL, NULL, 'SOLVED', '2026-07-16 15:52:44.888', '2026-07-20 12:42:24.981', 0, 'CANCEL_BOOKING');

-- --------------------------------------------------------

--
-- Table structure for table `conflicttimeline`
--

CREATE TABLE `conflicttimeline` (
  `id` int(11) NOT NULL,
  `conflictId` int(11) NOT NULL,
  `updatedByType` enum('ADMIN','MITRA','SYSTEM') NOT NULL,
  `updatedById` int(11) DEFAULT NULL,
  `oldStatus` enum('PENDING','IN_PROGRESS','SOLVED','UNRESOLVED') DEFAULT NULL,
  `newStatus` enum('PENDING','IN_PROGRESS','SOLVED','UNRESOLVED') NOT NULL,
  `note` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `conflicttimeline`
--

INSERT INTO `conflicttimeline` (`id`, `conflictId`, `updatedByType`, `updatedById`, `oldStatus`, `newStatus`, `note`, `createdAt`) VALUES
(1, 1, 'SYSTEM', NULL, NULL, 'PENDING', 'Issue raised by CLIENT. Reason: Worker late hai. Action: CANCEL_BOOKING. Continue work: No. Assigned Mitra ID: 1', '2026-07-16 15:52:44.891'),
(2, 1, 'ADMIN', NULL, 'PENDING', 'SOLVED', 'jhmg', '2026-07-20 12:42:24.988');

-- --------------------------------------------------------

--
-- Table structure for table `customer`
--

CREATE TABLE `customer` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `phone` varchar(191) NOT NULL,
  `email` varchar(191) DEFAULT NULL,
  `otp` varchar(191) DEFAULT NULL,
  `otpExpiry` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `pushToken` text DEFAULT NULL,
  `businessName` varchar(191) DEFAULT NULL,
  `businessType` varchar(191) DEFAULT NULL,
  `isVerified` tinyint(1) NOT NULL DEFAULT 0,
  `siteAddress` text DEFAULT NULL,
  `clientType` varchar(191) DEFAULT NULL,
  `gstNumber` varchar(191) DEFAULT NULL,
  `workerRequirement` varchar(191) DEFAULT NULL,
  `mitraId` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer`
--

INSERT INTO `customer` (`id`, `name`, `phone`, `email`, `otp`, `otpExpiry`, `createdAt`, `updatedAt`, `pushToken`, `businessName`, `businessType`, `isVerified`, `siteAddress`, `clientType`, `gstNumber`, `workerRequirement`, `mitraId`) VALUES
(1, 'Sarvesh Gandhere', '8369350353', 'sarveshgandhere2002-7@okaxis', NULL, NULL, '2026-05-12 09:46:56.758', '2026-05-22 14:35:28.760', 'ExponentPushToken[KgrLNSJ8AbQb5Ts4J5BFml]', NULL, NULL, 1, 'dombivli west\r\nold dombivli rpad', 'Individual', NULL, '15-50', 1),
(2, 'sarvesh gandhere', '8369552205', 'gandheresarvesh@gmail.com', NULL, NULL, '2026-05-12 09:57:34.864', '2026-07-12 12:18:36.405', 'ExponentPushToken[2jqMRdMp1m9XpPTLQtFczG]', NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL),
(3, 'Sarvesh', '8369350354', 'dprazor7@gmail.com', NULL, NULL, '2026-05-12 10:34:53.327', '2026-05-12 10:35:50.872', NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL),
(4, 'Sarvesh', '8369350355', 'newdposs7@gmail.com', NULL, NULL, '2026-05-12 10:42:09.102', '2026-05-12 10:43:41.015', NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL),
(5, 'TrivexaIT', '8369350344', 'trivexaitsolutions@gmail.com', NULL, NULL, '2026-05-22 13:45:30.497', '2026-05-22 13:45:30.497', NULL, 'testing facility', 'Retail', 1, 'murbad', 'Company', '87687637862838927', '15-50', NULL),
(6, 'Menon', '6789067890', 'menon@gmail.com', NULL, NULL, '2026-05-22 14:05:33.263', '2026-05-22 14:05:33.263', NULL, 'testing facility', 'Warehouse', 1, 'dombivli west\r\nold dombivli rpad', 'Company', '76876872', '5-15', NULL),
(7, 'Namajoshi', '9876987600', 'joshi@gmail.com', NULL, NULL, '2026-05-22 14:25:35.058', '2026-05-22 14:25:35.058', NULL, 'testing facility', 'Retail', 1, 'dombivli west\r\nold dombivli rpad', 'Company', '387982379823', '15-50', NULL),
(8, 'mindspace', '9876598765', 'sarveshgandhere2002@gmail.com', NULL, NULL, '2026-06-29 09:30:22.802', '2026-06-29 09:30:22.802', NULL, NULL, NULL, 1, 'dombivli west\r\nold dombivli rpad', 'Individual', NULL, '5-15', 1);

-- --------------------------------------------------------

--
-- Table structure for table `customeraddress`
--

CREATE TABLE `customeraddress` (
  `id` int(11) NOT NULL,
  `customerId` int(11) NOT NULL,
  `title` varchar(191) DEFAULT NULL,
  `fullName` varchar(191) DEFAULT NULL,
  `phone` varchar(191) DEFAULT NULL,
  `addressLine` varchar(191) NOT NULL,
  `landmark` varchar(191) DEFAULT NULL,
  `city` varchar(191) DEFAULT NULL,
  `state` varchar(191) DEFAULT NULL,
  `pincode` varchar(191) DEFAULT NULL,
  `latitude` varchar(191) DEFAULT NULL,
  `longitude` varchar(191) DEFAULT NULL,
  `isDefault` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `cityId` int(11) DEFAULT NULL,
  `nakaId` int(11) DEFAULT NULL,
  `nakaName` varchar(191) DEFAULT NULL,
  `addressDetail` text DEFAULT NULL,
  `locationSource` varchar(191) DEFAULT NULL,
  `mapAddress` text DEFAULT NULL,
  `placeId` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customeraddress`
--

INSERT INTO `customeraddress` (`id`, `customerId`, `title`, `fullName`, `phone`, `addressLine`, `landmark`, `city`, `state`, `pincode`, `latitude`, `longitude`, `isDefault`, `createdAt`, `updatedAt`, `cityId`, `nakaId`, `nakaName`, `addressDetail`, `locationSource`, `mapAddress`, `placeId`) VALUES
(1, 2, 'Home', 'sarvesh gandhere', '8369552205', '002, Sharvari - A', 'Shiv mandir', 'Dombivli', 'Maharshtra', '421202', NULL, NULL, 1, '2026-06-03 10:03:43.955', '2026-06-03 10:04:51.414', 1, 1, 'Station East', NULL, NULL, NULL, NULL),
(2, 2, 'Office', 'sarvesh gandhere', '8369552205', 'Test address', 'Mumbai', 'Mumbai', 'Maharashtra', '40002', NULL, NULL, 0, '2026-06-03 10:04:45.609', '2026-06-03 10:04:51.397', 2, 4, 'kurla naka', NULL, NULL, NULL, NULL),
(3, 8, 'Primary Work Site', 'mindspace', '9876598765', 'dombivli west\r\nold dombivli rpad', NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-06-29 09:30:22.825', '2026-06-29 09:30:22.825', NULL, NULL, NULL, NULL, 'MANUAL', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `employee`
--

CREATE TABLE `employee` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `email` varchar(191) NOT NULL,
  `password` varchar(191) NOT NULL,
  `role` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employee`
--

INSERT INTO `employee` (`id`, `name`, `email`, `password`, `role`, `createdAt`, `updatedAt`) VALUES
(1, 'Super Admin', 'admin@eman.com', '$2b$10$kRpXHiGt60tL2mHZj9s.NeOzDgmCXiui6BywwGYOBBJP$2y$10$GEYuc5tXpMiftScUA5EgUOqyGr0.13q.6qpwtOOBzlv2sD6Yv9m.i', 'superadmin', '2026-04-17 09:23:16.890', '2026-04-17 09:23:16.890');

-- --------------------------------------------------------

--
-- Table structure for table `mitra`
--

CREATE TABLE `mitra` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `phone` varchar(191) NOT NULL,
  `email` varchar(191) DEFAULT NULL,
  `password` varchar(191) NOT NULL,
  `photoUrl` varchar(191) DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `mitra`
--

INSERT INTO `mitra` (`id`, `name`, `phone`, `email`, `password`, `photoUrl`, `isActive`, `createdAt`, `updatedAt`) VALUES
(1, 'Sarvesh sanjay gandhere', '8369350353', 'mitra1@gmail.com', '$2b$10$9Y8BWkCG0CFw.M5W5tRFwe0VLUFD98567DAcKj7MFEaCjGcXr6yc.', NULL, 1, '2026-05-20 12:44:08.366', '2026-07-07 16:21:26.712');

-- --------------------------------------------------------

--
-- Table structure for table `naka`
--

CREATE TABLE `naka` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `pincode` varchar(191) DEFAULT NULL,
  `latitude` double DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `confidenceLevel` varchar(191) DEFAULT NULL,
  `landmark` varchar(191) DEFAULT NULL,
  `surveyDate` date DEFAULT NULL,
  `peakHourHeadcount` int(11) DEFAULT NULL,
  `surveyNotes` text DEFAULT NULL,
  `verificationPhotoUrl` varchar(191) DEFAULT NULL,
  `verificationStatus` varchar(191) NOT NULL DEFAULT 'PENDING_VERIFICATION',
  `lastVerifiedAt` datetime(3) DEFAULT NULL,
  `createdByType` varchar(191) NOT NULL DEFAULT 'LEGACY',
  `createdByMitraId` int(11) DEFAULT NULL,
  `createdByEmployeeId` int(11) DEFAULT NULL,
  `cityId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `naka`
--

INSERT INTO `naka` (`id`, `name`, `pincode`, `latitude`, `longitude`, `confidenceLevel`, `landmark`, `surveyDate`, `peakHourHeadcount`, `surveyNotes`, `verificationPhotoUrl`, `verificationStatus`, `lastVerifiedAt`, `createdByType`, `createdByMitraId`, `createdByEmployeeId`, `cityId`, `createdAt`, `updatedAt`) VALUES
(1, 'Station East', '421202', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'PENDING_VERIFICATION', NULL, 'LEGACY', NULL, NULL, 1, '2026-04-17 09:23:50.850', '2026-04-17 09:23:50.850'),
(2, 'Chakki naka', '421200', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'PENDING_VERIFICATION', NULL, 'LEGACY', NULL, NULL, 2, '2026-04-17 13:11:06.614', '2026-04-17 13:11:06.614'),
(3, 'Chakki naka', '421202', 19.224064, 73.126711, 'HIGH', 'near bridge', '2026-07-07', 60, 'test', '/uploads/naka-verification/1783438731725-472765972.png', 'VERIFIED', '2026-07-07 15:38:51.748', 'LEGACY', NULL, NULL, 1, '2026-05-20 08:42:19.831', '2026-07-07 15:38:51.755'),
(4, 'kurla naka', '400004', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'PENDING_VERIFICATION', NULL, 'LEGACY', NULL, NULL, 2, '2026-05-21 13:12:52.257', '2026-06-28 19:15:44.555'),
(5, 'test naka', '421200', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'PENDING_VERIFICATION', NULL, 'LEGACY', NULL, NULL, 2, '2026-06-28 19:15:31.267', '2026-06-28 19:15:31.267'),
(6, 'Marol naka', '400014', 19.108413, 72.877845, NULL, NULL, NULL, NULL, NULL, NULL, 'PENDING_VERIFICATION', NULL, 'LEGACY', NULL, NULL, 2, '2026-06-29 07:58:30.842', '2026-06-29 07:58:30.842'),
(7, 'Station west', NULL, 19.2278, 73.0854, 'HIGH', 'near bridge', '2026-07-07', 50, 'testing', '/uploads/naka-verification/1783438821179-181220827.png', 'VERIFIED', '2026-07-07 15:40:21.198', 'LEGACY', NULL, NULL, 1, '2026-07-07 15:40:21.200', '2026-07-07 15:40:21.200'),
(8, 'dombivli station east', NULL, 19.217651, 73.088468, 'HIGH', 'kalyan bridge', '2026-07-07', 100, 'testing', '/uploads/naka-verification/naka-1783440074090-302170871.png', 'VERIFIED', '2026-07-07 16:02:01.439', 'MITRA', 1, NULL, 1, '2026-07-07 16:01:14.106', '2026-07-07 16:02:01.445'),
(9, 'Kopar Station West', '421202', 19.218706, 73.079643, 'HIGH', 'near bridge', '2026-07-07', 39, 'timing', '/uploads/naka-verification/naka-1783441174097-21944919.png', 'VERIFIED', '2026-07-07 16:19:34.116', 'ADMIN', NULL, 1, 1, '2026-07-07 16:19:34.128', '2026-07-07 16:19:34.128');

-- --------------------------------------------------------

--
-- Table structure for table `nakaverification`
--

CREATE TABLE `nakaverification` (
  `id` int(11) NOT NULL,
  `nakaId` int(11) NOT NULL,
  `verifiedById` int(11) NOT NULL,
  `verificationMethod` varchar(191) NOT NULL,
  `verificationNote` text NOT NULL,
  `verifiedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `photoUrl` varchar(191) DEFAULT NULL,
  `surveyDate` date DEFAULT NULL,
  `peakHourHeadcount` int(11) DEFAULT NULL,
  `latitude` double DEFAULT NULL,
  `longitude` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `nakaverification`
--

INSERT INTO `nakaverification` (`id`, `nakaId`, `verifiedById`, `verificationMethod`, `verificationNote`, `verifiedAt`, `photoUrl`, `surveyDate`, `peakHourHeadcount`, `latitude`, `longitude`) VALUES
(1, 3, 1, 'ADMIN_ON_SITE_VISIT', 'testing', '2026-07-07 15:38:51.748', '/uploads/naka-verification/1783438731725-472765972.png', '2026-07-07', 60, 19.224064, 73.126711),
(2, 7, 1, 'PHOTO_GPS_REVIEW', 'testing', '2026-07-07 15:40:21.198', '/uploads/naka-verification/1783438821179-181220827.png', '2026-07-07', 50, 19.2278, 73.0854),
(3, 8, 1, 'ADMIN_ON_SITE_VISIT', 'done verification', '2026-07-07 16:02:01.439', '/uploads/naka-verification/naka-1783440074090-302170871.png', '2026-07-07', 100, 19.217651, 73.088468),
(4, 9, 1, 'ADMIN_ON_SITE_VISIT', 'testing', '2026-07-07 16:19:34.116', '/uploads/naka-verification/naka-1783441174097-21944919.png', '2026-07-07', 39, 19.218706, 73.079643);

-- --------------------------------------------------------

--
-- Table structure for table `rating`
--

CREATE TABLE `rating` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) NOT NULL,
  `workerId` int(11) NOT NULL,
  `mehnat` int(11) NOT NULL,
  `vyavhaar` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `rating`
--

INSERT INTO `rating` (`id`, `bookingId`, `workerId`, `mehnat`, `vyavhaar`, `createdAt`) VALUES
(1, 2, 1, 3, 4, '2026-07-16 15:55:55.367'),
(2, 3, 1, 3, 5, '2026-07-16 15:57:19.818'),
(3, 4, 1, 4, 4, '2026-07-16 16:15:10.223'),
(4, 5, 1, 4, 4, '2026-07-16 16:18:06.510'),
(5, 6, 1, 4, 4, '2026-07-20 12:42:53.700');

-- --------------------------------------------------------

--
-- Table structure for table `skill`
--

CREATE TABLE `skill` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `description` text DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `imageUrl` varchar(191) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `skill`
--

INSERT INTO `skill` (`id`, `name`, `description`, `isActive`, `createdAt`, `updatedAt`, `imageUrl`) VALUES
(1, 'Plumbing', '', 1, '2026-04-17 09:24:12.121', '2026-04-17 09:24:12.121', NULL),
(2, 'Painter', '', 1, '2026-04-17 13:11:48.940', '2026-04-17 13:11:48.940', NULL),
(3, 'Loading', 'Loading', 1, '2026-05-21 06:50:42.961', '2026-05-21 06:50:42.961', '/uploads/skills/skill-1779346242938-658342242.webp');

-- --------------------------------------------------------

--
-- Table structure for table `skillrate`
--

CREATE TABLE `skillrate` (
  `id` int(11) NOT NULL,
  `skillId` int(11) NOT NULL,
  `star` double NOT NULL,
  `rate` double NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `skillrate`
--

INSERT INTO `skillrate` (`id`, `skillId`, `star`, `rate`, `createdAt`, `updatedAt`) VALUES
(1, 1, 1, 400, '2026-04-17 09:24:12.129', '2026-04-17 09:24:12.129'),
(2, 1, 2, 600, '2026-04-17 09:24:12.129', '2026-04-17 09:24:12.129'),
(3, 1, 3, 700, '2026-04-17 09:24:12.129', '2026-04-17 09:24:12.129'),
(4, 1, 4, 900, '2026-04-17 09:24:12.129', '2026-04-17 09:24:12.129'),
(5, 1, 5, 1200, '2026-04-17 09:24:12.129', '2026-04-17 09:24:12.129'),
(6, 2, 1, 400, '2026-04-17 13:11:48.947', '2026-04-17 13:11:48.947'),
(7, 2, 2, 500, '2026-04-17 13:11:48.947', '2026-04-17 13:11:48.947'),
(8, 2, 3, 700, '2026-04-17 13:11:48.947', '2026-04-17 13:11:48.947'),
(9, 2, 4, 800, '2026-04-17 13:11:48.947', '2026-04-17 13:11:48.947'),
(10, 2, 5, 1000, '2026-04-17 13:11:48.947', '2026-04-17 13:11:48.947'),
(11, 3, 1, 200, '2026-05-21 06:50:42.990', '2026-05-21 06:50:42.990'),
(12, 3, 2, 300, '2026-05-21 06:50:42.990', '2026-05-21 06:50:42.990'),
(13, 3, 3, 450, '2026-05-21 06:50:42.990', '2026-05-21 06:50:42.990'),
(14, 3, 4, 700, '2026-05-21 06:50:42.990', '2026-05-21 06:50:42.990'),
(15, 3, 5, 1000, '2026-05-21 06:50:42.990', '2026-05-21 06:50:42.990');

-- --------------------------------------------------------

--
-- Table structure for table `state`
--

CREATE TABLE `state` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `code` varchar(191) NOT NULL,
  `type` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `state`
--

INSERT INTO `state` (`id`, `name`, `code`, `type`, `createdAt`, `updatedAt`) VALUES
(1, 'Andhra Pradesh', 'AP', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(2, 'Arunachal Pradesh', 'AR', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(3, 'Assam', 'AS', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(4, 'Bihar', 'BR', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(5, 'Chhattisgarh', 'CG', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(6, 'Goa', 'GA', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(7, 'Gujarat', 'GJ', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(8, 'Haryana', 'HR', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(9, 'Himachal Pradesh', 'HP', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(10, 'Jharkhand', 'JH', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(11, 'Karnataka', 'KA', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(12, 'Kerala', 'KL', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(13, 'Madhya Pradesh', 'MP', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(14, 'Maharashtra', 'MH', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(15, 'Manipur', 'MN', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(16, 'Meghalaya', 'ML', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(17, 'Mizoram', 'MZ', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(18, 'Nagaland', 'NL', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(19, 'Odisha', 'OD', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(20, 'Punjab', 'PB', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(21, 'Rajasthan', 'RJ', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(22, 'Sikkim', 'SK', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(23, 'Tamil Nadu', 'TN', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(24, 'Telangana', 'TS', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(25, 'Tripura', 'TR', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(26, 'Uttar Pradesh', 'UP', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(27, 'Uttarakhand', 'UK', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(28, 'West Bengal', 'WB', 'STATE', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(29, 'Andaman and Nicobar Islands', 'AN', 'UNION_TERRITORY', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(30, 'Chandigarh', 'CH', 'UNION_TERRITORY', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(31, 'Dadra and Nagar Haveli and Daman and Diu', 'DH', 'UNION_TERRITORY', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(32, 'Delhi', 'DL', 'UNION_TERRITORY', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(33, 'Jammu and Kashmir', 'JK', 'UNION_TERRITORY', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(34, 'Ladakh', 'LA', 'UNION_TERRITORY', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(35, 'Lakshadweep', 'LD', 'UNION_TERRITORY', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003'),
(36, 'Puducherry', 'PY', 'UNION_TERRITORY', '2026-07-07 20:53:09.003', '2026-07-07 20:53:09.003');

-- --------------------------------------------------------

--
-- Table structure for table `worker`
--

CREATE TABLE `worker` (
  `id` int(11) NOT NULL,
  `name` varchar(191) NOT NULL,
  `phone` varchar(191) NOT NULL,
  `email` varchar(191) DEFAULT NULL,
  `password` varchar(191) NOT NULL,
  `dob` date NOT NULL,
  `age` int(11) NOT NULL,
  `qualification` varchar(191) DEFAULT NULL,
  `photoUrl` varchar(191) DEFAULT NULL,
  `idProofType` varchar(191) NOT NULL,
  `idNumber` varchar(191) NOT NULL,
  `consentVoiceUrl` varchar(191) DEFAULT NULL,
  `address` text NOT NULL,
  `pincode` varchar(191) NOT NULL,
  `bankDetails` text DEFAULT NULL,
  `upiId` varchar(191) DEFAULT NULL,
  `upiNumber` varchar(191) DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `isAvailable` tinyint(1) NOT NULL DEFAULT 0,
  `lastActive` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `pushToken` text DEFAULT NULL,
  `mitraId` int(11) DEFAULT NULL,
  `availabilityHours` int(11) DEFAULT NULL,
  `availabilityStart` datetime(3) DEFAULT NULL,
  `availabilityType` varchar(191) DEFAULT NULL,
  `availabilityUntil` datetime(3) DEFAULT NULL,
  `aadhaarNumber` varchar(191) DEFAULT NULL,
  `bmi` double DEFAULT NULL,
  `gender` varchar(191) DEFAULT NULL,
  `heightCm` double DEFAULT NULL,
  `otherIdNumber` varchar(191) DEFAULT NULL,
  `panNumber` varchar(191) DEFAULT NULL,
  `weightKg` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `worker`
--

INSERT INTO `worker` (`id`, `name`, `phone`, `email`, `password`, `dob`, `age`, `qualification`, `photoUrl`, `idProofType`, `idNumber`, `consentVoiceUrl`, `address`, `pincode`, `bankDetails`, `upiId`, `upiNumber`, `isActive`, `createdAt`, `updatedAt`, `isAvailable`, `lastActive`, `pushToken`, `mitraId`, `availabilityHours`, `availabilityStart`, `availabilityType`, `availabilityUntil`, `aadhaarNumber`, `bmi`, `gender`, `heightCm`, `otherIdNumber`, `panNumber`, `weightKg`) VALUES
(1, 'Vinit', '8369552205', 'vinit@gmail.com', '$2b$10$BBEczqOLw.Q0Mn4DgCIL9ODjbVvE7O.BatPMNOI/OIpzl0m/CEG.C', '2005-05-20', 20, NULL, NULL, 'AADHAR', '1234567891234', '/uploads/voice/1776418004591-527175489.MP3', '002, sharvari A wing, Kailash nagar, Old dombivli road, near suswagatam bar\r\nsharvari A- wing', '421202', 'DNS0000123', 'sarveshgandhere2002@gmail.com', '8369350353', 1, '2026-04-17 09:26:44.743', '2026-07-20 14:35:41.939', 1, '2026-07-20 14:35:41.936', 'ExponentPushToken[Zq-SZrJLq65P60GCkwurib]', NULL, NULL, '2026-07-20 14:35:41.936', 'FULL_DAY', '2026-07-20 18:29:00.000', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(2, 'Sarvesh Gandhere', '8369350353', NULL, '$2b$10$7A94SF8U.6oHFhWffdEx3.qXPju6e3P6Ze7HsrAu2FbtNe5tm.ZXi', '2026-05-01', 30, NULL, NULL, 'AADHAR', '8368327983', '/uploads/consents/consent-1779351539937.webm', 'dombivli west\r\nold dombivli rpad', '421202', 'hvdhvhjsbhjvhjsbhjbvhjds', '8369350353@kotak811', '8369350353', 1, '2026-05-21 08:19:00.222', '2026-05-21 08:19:00.222', 0, '2026-05-21 08:19:00.222', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(5, 'sarvesh gandhere', '9892972554', NULL, '$2b$10$ZWCv2ApbiFgK6lijOyaapeF..IksCvIpyb.HHemzO5uP0AsLVbG96', '2026-05-02', 45, NULL, NULL, 'AADHAR', '67676867678', '/uploads/consents/consent-1779369055353.webm', 'Old Dombivli\r\nSharvari Building', '421202', 'hg gv gvh vhgvhg hgcg hgccc', 'gandheresarvesh@gmail.com', '8456789456', 1, '2026-05-21 13:10:55.607', '2026-05-21 13:10:55.607', 0, '2026-05-21 13:10:55.607', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(6, 'Tushar Kandekar', '9892972553', NULL, '$2b$10$S45H3RTgFCipzL09kVh.hOWnrE.TBY.leUrIon2862TGg8iFJIb5C', '2026-01-15', 78, NULL, NULL, 'VOTING', '678678678678', '/uploads/consents/consent-1781356173620.webm', 'hgvdf bs fhs vfhs fshvfgs fbsvhg', '422203', 'hgavef shgvfhs gfvsyf sfgvdsgfvdsgfhs', 'sarveshgandhere2002-7@okaxis', '8369350353', 1, '2026-06-13 13:09:33.854', '2026-06-28 18:11:44.705', 0, '2026-06-13 13:09:33.854', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '678678678678', NULL, NULL),
(7, 'Manish Paul', '9876987678', NULL, '$2b$10$rOLoXJnrom7p6HM3yZLOBOFJpN3zXNozFsXLO6r3NUgURSmcBUx6a', '2000-02-23', 26, NULL, NULL, 'AADHAR', '987698769876', '/uploads/consents/consent-1782672085990.webm', '002, sharvari, titwala', '423202', 'hgvhd b hdvewhd wnbehdewh d weh', '8369350353@kotak811', '8369350353', 1, '2026-06-28 18:41:26.342', '2026-06-28 18:41:26.342', 0, '2026-06-28 18:41:26.342', NULL, 1, NULL, NULL, NULL, NULL, '987698769876', 19, 'MALE', 200, NULL, NULL, 76),
(9, 'naman', '7897897890', NULL, '$2b$10$QPhI/WEC2jQyRfvY0Avxs.Wayt2lcEi/UcomAvP3FZT0hl9iiWkpO', '2004-02-05', 22, NULL, NULL, 'AADHAR', '987698769889', '/uploads/consents/consent-1782674456648.webm', 'hgvhf hbe fh hf hd', '421200', 'hgvhfds hf h fbf', '8369350353@kotak811', '8369350353', 1, '2026-06-28 19:20:56.932', '2026-06-28 19:20:56.932', 0, '2026-06-28 19:20:56.932', NULL, 1, NULL, NULL, NULL, NULL, '987698769889', 21.8, 'MALE', 200, NULL, NULL, 87),
(10, 'Dinesh Iyyer', '9078907890', NULL, '$2b$10$1LW3GtvGueXVcht/lEAHzuuM9FTNyVBe8B1FffwAgmWvnqIuSI8UC', '2000-08-11', 25, NULL, NULL, 'AADHAR', '907890789078', '/uploads/consents/consent-1782716234977.webm', 'dombivli west\r\nold dombivli rpad', '421202', 'hgvg hg v v hfhgvchg gv', '8369350353@kotak811', '8369350353', 1, '2026-06-29 06:57:15.094', '2026-06-29 06:57:15.094', 0, '2026-06-29 06:57:15.094', NULL, 1, NULL, NULL, NULL, NULL, '907890789078', 23.4, 'MALE', 160, NULL, NULL, 60),
(11, 'Manas Manas', '9078907892', NULL, '$2b$10$t8w5w2CKXs2h6CN1tpq2ceDJKklyb5KWjU6xyEMeGBymjH6OooEjW', '2006-02-03', 20, NULL, NULL, 'AADHAR', '456745674567', '/uploads/consents/consent-1782717925721.webm', 'bfdhhfhbf hg fchs hh', '435435', 'hgvhfvh f hvfh f bhfb efhe', '8369350353@kotak811', '8369350353', 1, '2026-06-29 07:25:25.825', '2026-06-29 07:25:25.825', 0, '2026-06-29 07:25:25.825', NULL, 1, NULL, NULL, NULL, NULL, '456745674567', 18.5, 'MALE', 180, NULL, NULL, 60);

-- --------------------------------------------------------

--
-- Table structure for table `workerclientrating`
--

CREATE TABLE `workerclientrating` (
  `id` int(11) NOT NULL,
  `bookingId` int(11) NOT NULL,
  `workerId` int(11) NOT NULL,
  `customerId` int(11) NOT NULL,
  `rating` int(11) NOT NULL,
  `behaviour` int(11) DEFAULT NULL,
  `locationAccuracy` int(11) DEFAULT NULL,
  `coordination` int(11) DEFAULT NULL,
  `comment` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `workerclientrating`
--

INSERT INTO `workerclientrating` (`id`, `bookingId`, `workerId`, `customerId`, `rating`, `behaviour`, `locationAccuracy`, `coordination`, `comment`, `createdAt`, `updatedAt`) VALUES
(1, 3, 1, 2, 5, 5, 5, 5, NULL, '2026-07-16 15:57:15.813', '2026-07-16 15:57:15.813'),
(2, 6, 1, 2, 5, 5, 5, 5, 'Cycvj j', '2026-07-20 12:43:07.098', '2026-07-20 12:43:07.098');

-- --------------------------------------------------------

--
-- Table structure for table `_bookingtoworker`
--

CREATE TABLE `_bookingtoworker` (
  `A` int(11) NOT NULL,
  `B` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `_bookingtoworker`
--

INSERT INTO `_bookingtoworker` (`A`, `B`) VALUES
(1, 1),
(2, 1),
(3, 1),
(4, 1),
(5, 1),
(6, 1);

-- --------------------------------------------------------

--
-- Table structure for table `_mitratonaka`
--

CREATE TABLE `_mitratonaka` (
  `A` int(11) NOT NULL,
  `B` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `_mitratonaka`
--

INSERT INTO `_mitratonaka` (`A`, `B`) VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 8),
(1, 9);

-- --------------------------------------------------------

--
-- Table structure for table `_nakatoworker`
--

CREATE TABLE `_nakatoworker` (
  `A` int(11) NOT NULL,
  `B` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `_nakatoworker`
--

INSERT INTO `_nakatoworker` (`A`, `B`) VALUES
(1, 2),
(1, 5),
(1, 6),
(1, 10),
(2, 2),
(2, 5),
(2, 6),
(2, 7),
(2, 9),
(2, 10),
(2, 11),
(3, 1),
(3, 2),
(3, 5),
(3, 6),
(9, 1);

-- --------------------------------------------------------

--
-- Table structure for table `_skilltoworker`
--

CREATE TABLE `_skilltoworker` (
  `A` int(11) NOT NULL,
  `B` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `_skilltoworker`
--

INSERT INTO `_skilltoworker` (`A`, `B`) VALUES
(1, 1),
(1, 2),
(1, 5),
(1, 6),
(1, 7),
(1, 9),
(1, 10),
(2, 2),
(2, 5),
(2, 6),
(2, 7),
(2, 9),
(2, 10),
(2, 11),
(3, 2),
(3, 5),
(3, 6),
(3, 7),
(3, 9);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `booking`
--
ALTER TABLE `booking`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Booking_razorpayOrderId_key` (`razorpayOrderId`),
  ADD UNIQUE KEY `Booking_razorpayPaymentId_key` (`razorpayPaymentId`),
  ADD KEY `Booking_customerId_fkey` (`customerId`),
  ADD KEY `booking_addressId_idx` (`addressId`);

--
-- Indexes for table `bookingsetting`
--
ALTER TABLE `bookingsetting`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `city`
--
ALTER TABLE `city`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `City_stateId_name_key` (`stateId`,`name`),
  ADD KEY `City_stateId_fkey` (`stateId`);

--
-- Indexes for table `citypincode`
--
ALTER TABLE `citypincode`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `CityPincode_pincode_key` (`pincode`),
  ADD KEY `CityPincode_cityId_fkey` (`cityId`);

--
-- Indexes for table `conflict`
--
ALTER TABLE `conflict`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Conflict_bookingId_fkey` (`bookingId`);

--
-- Indexes for table `conflicttimeline`
--
ALTER TABLE `conflicttimeline`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ConflictTimeline_conflictId_fkey` (`conflictId`);

--
-- Indexes for table `customer`
--
ALTER TABLE `customer`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Customer_phone_key` (`phone`),
  ADD UNIQUE KEY `Customer_email_key` (`email`),
  ADD KEY `Customer_mitraId_fkey` (`mitraId`);

--
-- Indexes for table `customeraddress`
--
ALTER TABLE `customeraddress`
  ADD PRIMARY KEY (`id`),
  ADD KEY `CustomerAddress_customerId_fkey` (`customerId`);

--
-- Indexes for table `employee`
--
ALTER TABLE `employee`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Employee_email_key` (`email`);

--
-- Indexes for table `mitra`
--
ALTER TABLE `mitra`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Mitra_phone_key` (`phone`),
  ADD UNIQUE KEY `Mitra_email_key` (`email`);

--
-- Indexes for table `naka`
--
ALTER TABLE `naka`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Naka_cityId_fkey` (`cityId`),
  ADD KEY `naka_verification_status_last_verified_at_idx` (`verificationStatus`,`lastVerifiedAt`),
  ADD KEY `idx_naka_created_by_mitra` (`createdByMitraId`),
  ADD KEY `idx_naka_created_by_employee` (`createdByEmployeeId`);

--
-- Indexes for table `nakaverification`
--
ALTER TABLE `nakaverification`
  ADD PRIMARY KEY (`id`),
  ADD KEY `nakaverification_naka_id_verified_at_idx` (`nakaId`,`verifiedAt`),
  ADD KEY `nakaverification_verified_by_id_idx` (`verifiedById`);

--
-- Indexes for table `rating`
--
ALTER TABLE `rating`
  ADD PRIMARY KEY (`id`),
  ADD KEY `Rating_bookingId_fkey` (`bookingId`);

--
-- Indexes for table `skill`
--
ALTER TABLE `skill`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Skill_name_key` (`name`);

--
-- Indexes for table `skillrate`
--
ALTER TABLE `skillrate`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `SkillRate_skillId_star_key` (`skillId`,`star`);

--
-- Indexes for table `state`
--
ALTER TABLE `state`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `State_name_key` (`name`),
  ADD UNIQUE KEY `State_code_key` (`code`);

--
-- Indexes for table `worker`
--
ALTER TABLE `worker`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `Worker_phone_key` (`phone`),
  ADD UNIQUE KEY `Worker_idNumber_key` (`idNumber`),
  ADD UNIQUE KEY `Worker_email_key` (`email`),
  ADD UNIQUE KEY `Worker_aadhaarNumber_key` (`aadhaarNumber`),
  ADD UNIQUE KEY `Worker_panNumber_key` (`panNumber`),
  ADD UNIQUE KEY `Worker_otherIdNumber_key` (`otherIdNumber`),
  ADD KEY `Worker_mitraId_fkey` (`mitraId`);

--
-- Indexes for table `workerclientrating`
--
ALTER TABLE `workerclientrating`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `WorkerClientRating_bookingId_workerId_key` (`bookingId`,`workerId`);

--
-- Indexes for table `_bookingtoworker`
--
ALTER TABLE `_bookingtoworker`
  ADD UNIQUE KEY `_bookingtoworker_AB_unique` (`A`,`B`),
  ADD KEY `_bookingtoworker_B_index` (`B`);

--
-- Indexes for table `_mitratonaka`
--
ALTER TABLE `_mitratonaka`
  ADD UNIQUE KEY `_mitratonaka_AB_unique` (`A`,`B`),
  ADD KEY `_mitratonaka_B_index` (`B`);

--
-- Indexes for table `_nakatoworker`
--
ALTER TABLE `_nakatoworker`
  ADD UNIQUE KEY `_nakatoworker_AB_unique` (`A`,`B`),
  ADD KEY `_nakatoworker_B_index` (`B`);

--
-- Indexes for table `_skilltoworker`
--
ALTER TABLE `_skilltoworker`
  ADD UNIQUE KEY `_skilltoworker_AB_unique` (`A`,`B`),
  ADD KEY `_skilltoworker_B_index` (`B`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `booking`
--
ALTER TABLE `booking`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `city`
--
ALTER TABLE `city`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `citypincode`
--
ALTER TABLE `citypincode`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `conflict`
--
ALTER TABLE `conflict`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `conflicttimeline`
--
ALTER TABLE `conflicttimeline`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `customer`
--
ALTER TABLE `customer`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `customeraddress`
--
ALTER TABLE `customeraddress`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `employee`
--
ALTER TABLE `employee`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `mitra`
--
ALTER TABLE `mitra`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `naka`
--
ALTER TABLE `naka`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `nakaverification`
--
ALTER TABLE `nakaverification`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `rating`
--
ALTER TABLE `rating`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `skill`
--
ALTER TABLE `skill`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `skillrate`
--
ALTER TABLE `skillrate`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `state`
--
ALTER TABLE `state`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT for table `worker`
--
ALTER TABLE `worker`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `workerclientrating`
--
ALTER TABLE `workerclientrating`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `booking`
--
ALTER TABLE `booking`
  ADD CONSTRAINT `booking_addressId_fkey` FOREIGN KEY (`addressId`) REFERENCES `customeraddress` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `booking_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `city`
--
ALTER TABLE `city`
  ADD CONSTRAINT `city_stateId_fkey` FOREIGN KEY (`stateId`) REFERENCES `state` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `citypincode`
--
ALTER TABLE `citypincode`
  ADD CONSTRAINT `citypincode_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `city` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `conflict`
--
ALTER TABLE `conflict`
  ADD CONSTRAINT `conflict_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `booking` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `conflicttimeline`
--
ALTER TABLE `conflicttimeline`
  ADD CONSTRAINT `conflicttimeline_conflictId_fkey` FOREIGN KEY (`conflictId`) REFERENCES `conflict` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `customer`
--
ALTER TABLE `customer`
  ADD CONSTRAINT `customer_mitraId_fkey` FOREIGN KEY (`mitraId`) REFERENCES `mitra` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `customeraddress`
--
ALTER TABLE `customeraddress`
  ADD CONSTRAINT `customeraddress_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `naka`
--
ALTER TABLE `naka`
  ADD CONSTRAINT `naka_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `city` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `naka_createdByEmployeeId_fkey` FOREIGN KEY (`createdByEmployeeId`) REFERENCES `employee` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `naka_createdByMitraId_fkey` FOREIGN KEY (`createdByMitraId`) REFERENCES `mitra` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `nakaverification`
--
ALTER TABLE `nakaverification`
  ADD CONSTRAINT `nakaverification_nakaId_fkey` FOREIGN KEY (`nakaId`) REFERENCES `naka` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `nakaverification_verifiedById_fkey` FOREIGN KEY (`verifiedById`) REFERENCES `employee` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `rating`
--
ALTER TABLE `rating`
  ADD CONSTRAINT `rating_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `booking` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `skillrate`
--
ALTER TABLE `skillrate`
  ADD CONSTRAINT `skillrate_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `skill` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `worker`
--
ALTER TABLE `worker`
  ADD CONSTRAINT `worker_mitraId_fkey` FOREIGN KEY (`mitraId`) REFERENCES `mitra` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `workerclientrating`
--
ALTER TABLE `workerclientrating`
  ADD CONSTRAINT `workerclientrating_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `booking` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `_bookingtoworker`
--
ALTER TABLE `_bookingtoworker`
  ADD CONSTRAINT `_BookingToWorker_A_fkey` FOREIGN KEY (`A`) REFERENCES `booking` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `_BookingToWorker_B_fkey` FOREIGN KEY (`B`) REFERENCES `worker` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `_mitratonaka`
--
ALTER TABLE `_mitratonaka`
  ADD CONSTRAINT `_MitraToNaka_A_fkey` FOREIGN KEY (`A`) REFERENCES `mitra` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `_MitraToNaka_B_fkey` FOREIGN KEY (`B`) REFERENCES `naka` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `_nakatoworker`
--
ALTER TABLE `_nakatoworker`
  ADD CONSTRAINT `_NakaToWorker_A_fkey` FOREIGN KEY (`A`) REFERENCES `naka` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `_NakaToWorker_B_fkey` FOREIGN KEY (`B`) REFERENCES `worker` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `_skilltoworker`
--
ALTER TABLE `_skilltoworker`
  ADD CONSTRAINT `_SkillToWorker_A_fkey` FOREIGN KEY (`A`) REFERENCES `skill` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `_SkillToWorker_B_fkey` FOREIGN KEY (`B`) REFERENCES `worker` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

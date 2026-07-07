-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jun 30, 2026 at 07:55 AM
-- Server version: 8.4.3
-- PHP Version: 8.3.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `eman1`
--

-- --------------------------------------------------------

--
-- Table structure for table `booking`
--

CREATE TABLE `booking` (
  `id` int NOT NULL,
  `customerId` int NOT NULL,
  `nakaId` int NOT NULL,
  `skillId` int NOT NULL,
  `workerCount` int NOT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `amount` double DEFAULT NULL,
  `razorpayOrderId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `razorpayPaymentId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `arrivedWorkerIds` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '[]',
  `isRated` tinyint(1) NOT NULL DEFAULT '0',
  `cancelledWorkerIds` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '[]',
  `completedWorkerIds` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `booking`
--

INSERT INTO `booking` (`id`, `customerId`, `nakaId`, `skillId`, `workerCount`, `status`, `createdAt`, `updatedAt`, `amount`, `razorpayOrderId`, `razorpayPaymentId`, `arrivedWorkerIds`, `isRated`, `cancelledWorkerIds`, `completedWorkerIds`) VALUES
(1, 2, 1, 1, 1, 'ASSIGNED', '2026-06-01 17:28:05.801', '2026-06-01 17:30:08.649', 400, 'order_SwRvHsuqFneSyb', 'pay_SwRwvElo6ceNFV', '[]', 0, '[1]', NULL),
(2, 2, 1, 1, 1, 'ASSIGNED', '2026-06-01 17:30:52.753', '2026-06-01 17:31:37.251', 400, 'order_SwRyDzRSLQuSfu', 'pay_SwRyneygLIY63S', '[]', 0, '[]', NULL),
(3, 2, 1, 1, 1, 'ASSIGNED', '2026-06-01 17:32:22.294', '2026-06-01 17:33:17.929', 400, 'order_SwRznjvSDeHmjJ', 'pay_SwS0ETqNe3YuSp', '[]', 0, '[1]', NULL),
(4, 2, 1, 1, 1, 'ASSIGNED', '2026-06-01 17:36:33.355', '2026-06-01 17:37:37.657', 400, 'order_SwS4E0XBH0W8m9', 'pay_SwS4n7z4UEK1aX', '[]', 0, '[1]', NULL),
(5, 2, 1, 1, 1, 'ASSIGNED', '2026-06-01 17:38:22.381', '2026-06-01 17:39:03.922', 400, 'order_SwS68nyiBZyVPe', 'pay_SwS6fMRboApFAE', '[]', 0, '[]', NULL),
(6, 2, 1, 1, 1, 'ASSIGNED', '2026-06-01 17:40:00.389', '2026-06-01 17:41:09.562', 400, 'order_SwS7rq38zKwnsW', 'pay_SwS8Q5BRPnQqx7', '[]', 0, '[1]', NULL),
(7, 2, 1, 1, 1, 'ASSIGNED', '2026-06-03 10:51:09.534', '2026-06-03 10:52:15.597', 400, 'order_Sx8EDJUcJfseS7', 'pay_Sx8Ehh1YUt8B4Z', '[]', 0, '[1]', NULL),
(8, 2, 1, 1, 1, 'COMPLETED', '2026-06-08 05:59:18.815', '2026-06-08 06:01:56.122', 400, 'order_Sz1vXSl1oDUrzb', 'pay_Sz1wqH5lGkImKi', '[1]', 1, '[]', NULL),
(9, 2, 1, 1, 1, 'PENDING', '2026-06-08 06:02:46.297', '2026-06-08 06:02:46.471', 400, 'order_Sz1zBn24hzn7x8', NULL, '[]', 0, '[]', NULL),
(10, 2, 1, 1, 1, 'PENDING', '2026-06-10 17:15:52.612', '2026-06-10 17:15:53.128', 400, 'order_T00WSKY25azUhz', NULL, '[]', 0, '[]', NULL),
(11, 2, 1, 1, 1, 'COMPLETED', '2026-06-10 17:17:08.902', '2026-06-10 17:26:44.829', 400, 'order_T00XnB10NwyMP1', 'pay_T00YhVww0GgMLp', '[1]', 1, '[]', NULL),
(12, 2, 1, 1, 1, 'COMPLETED', '2026-06-10 17:27:25.596', '2026-06-10 17:30:41.460', 400, 'order_T00ieSYuwwuoeK', 'pay_T00j6kdaEmqnF2', '[1]', 1, '[]', NULL),
(13, 2, 1, 1, 1, 'COMPLETED', '2026-06-10 17:50:54.990', '2026-06-10 17:52:11.476', 400, 'order_T017Ss0IUU4FTl', 'pay_T018KDA6FdjVhU', '[1]', 1, '[]', NULL),
(14, 2, 1, 1, 1, 'COMPLETED', '2026-06-10 17:53:04.369', '2026-06-10 17:53:59.181', 400, 'order_T019k0CFVXDFLf', 'pay_T01AG2a01lYX19', '[1]', 1, '[]', NULL),
(15, 2, 1, 1, 1, 'IN_PROGRESS', '2026-06-10 18:13:34.296', '2026-06-10 18:14:22.274', 400, 'order_T01VOYC52rhDlQ', 'pay_T01VxJ2rFGI5im', '[1]', 0, '[]', NULL),
(16, 2, 1, 1, 1, 'COMPLETED', '2026-06-10 18:14:50.274', '2026-06-10 18:15:46.364', 400, 'order_T01WjS49JjDQ4w', 'pay_T01XBTRTPXlSIO', '[1]', 1, '[]', NULL),
(17, 2, 1, 1, 1, 'COMPLETED', '2026-06-10 18:16:46.075', '2026-06-10 18:17:44.622', 400, 'order_T01YlwRyqlJIAS', 'pay_T01ZKn0Zlswztl', '[1]', 0, '[]', NULL),
(18, 2, 1, 1, 1, 'COMPLETED', '2026-06-10 18:27:00.767', '2026-06-10 18:28:08.635', 400, 'order_T01japWMzJzlmT', 'pay_T01k9xtpvSMytl', '[1]', 0, '[]', NULL),
(19, 2, 1, 1, 1, 'COMPLETED', '2026-06-10 18:54:34.765', '2026-06-10 18:55:32.295', 400, 'order_T02CiQqpFtLCia', 'pay_T02DEY4Ih8bidg', '[1]', 0, '[]', '[1]'),
(20, 2, 1, 1, 1, 'COMPLETED', '2026-06-10 18:57:11.205', '2026-06-10 18:58:12.359', 400, 'order_T02FT2cQ4PPiFN', 'pay_T02Fwzzuo9zzyB', '[1]', 0, '[]', '[1]'),
(21, 2, 1, 1, 1, 'COMPLETED', '2026-06-12 06:11:18.016', '2026-06-12 06:12:48.124', 400, 'order_T0cGhK61JnlWD5', 'pay_T0cHUm02IK4tPE', '[1]', 0, '[]', '[1]'),
(22, 2, 1, 1, 1, 'COMPLETED', '2026-06-12 06:49:57.441', '2026-06-12 06:51:11.996', 400, 'order_T0cvVTSCAyWFJy', 'pay_T0cwD5f7tNGcGZ', '[1]', 1, '[]', '[1]'),
(23, 2, 1, 1, 1, 'CANCELLED', '2026-06-13 13:24:55.722', '2026-06-13 13:28:18.005', 400, 'order_T18Bs8xCq9opEC', 'pay_T18CZiWDckWODx', '[1]', 0, '[1]', NULL),
(24, 2, 1, 1, 1, 'IN_PROGRESS', '2026-06-13 13:29:17.222', '2026-06-13 13:33:45.458', 400, 'order_T18GTZnZnYQRgz', 'pay_T18H9FWXZ0ZIZP', '[1]', 0, '[1]', NULL),
(25, 2, 1, 1, 1, 'COMPLETED', '2026-06-13 13:40:01.069', '2026-06-13 13:43:03.051', 400, 'order_T18RoN2QAj1rlM', 'pay_T18TXhZ8GvImlx', '[1]', 1, '[]', '[1]'),
(26, 2, 1, 1, 1, 'ASSIGNED', '2026-06-13 13:43:33.648', '2026-06-13 13:46:44.741', 400, 'order_T18VYPNaoAlc5S', 'pay_T18XHzyzdAnx6g', '[]', 0, '[1]', NULL),
(27, 2, 1, 1, 1, 'ASSIGNED', '2026-06-21 17:54:10.028', '2026-06-21 17:56:32.146', 400, 'order_T4N3DYUkn5BRN2', 'pay_T4N5Z9bFn3792k', '[]', 0, '[]', NULL),
(28, 2, 1, 1, 1, 'PENDING', '2026-06-21 17:57:54.181', '2026-06-21 17:57:54.275', 400, 'order_T4N7AApC16pDGS', NULL, '[]', 0, '[]', NULL),
(29, 2, 1, 1, 1, 'COMPLETED', '2026-06-21 18:03:47.613', '2026-06-21 18:07:51.489', 400, 'order_T4NDOVV8EO4suY', 'pay_T4NEBcjz55G6fw', '[1]', 1, '[]', '[1]');

-- --------------------------------------------------------

--
-- Table structure for table `city`
--

CREATE TABLE `city` (
  `id` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `city`
--

INSERT INTO `city` (`id`, `name`, `createdAt`, `updatedAt`) VALUES
(1, 'Dombivli', '2026-04-17 09:23:34.247', '2026-04-17 09:23:34.247'),
(2, 'Mumbai', '2026-04-17 13:10:43.968', '2026-04-17 13:10:43.968');

-- --------------------------------------------------------

--
-- Table structure for table `conflict`
--

CREATE TABLE `conflict` (
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `raisedByType` enum('CLIENT','WORKER') COLLATE utf8mb4_unicode_ci NOT NULL,
  `raisedById` int DEFAULT NULL,
  `customerId` int DEFAULT NULL,
  `workerId` int DEFAULT NULL,
  `mitraId` int DEFAULT NULL,
  `reason` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `penaltyAmount` int DEFAULT NULL,
  `status` enum('PENDING','IN_PROGRESS','SOLVED','UNRESOLVED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `continueWork` tinyint(1) NOT NULL DEFAULT '1',
  `requestedAction` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `conflict`
--

INSERT INTO `conflict` (`id`, `bookingId`, `raisedByType`, `raisedById`, `customerId`, `workerId`, `mitraId`, `reason`, `description`, `penaltyAmount`, `status`, `createdAt`, `updatedAt`, `continueWork`, `requestedAction`) VALUES
(1, 1, 'WORKER', 1, 2, 1, NULL, 'Client phone receive nahi kar raha', NULL, 100, 'PENDING', '2026-06-01 17:30:08.637', '2026-06-01 17:30:08.637', 0, 'CANCEL_DUTY'),
(2, 2, 'CLIENT', 2, 2, NULL, NULL, 'Worker late hai', NULL, NULL, 'PENDING', '2026-06-01 17:31:55.546', '2026-06-01 17:31:55.546', 0, 'CANCEL_BOOKING'),
(3, 3, 'CLIENT', 2, 2, 1, NULL, 'Wrong worker assigned', NULL, NULL, 'PENDING', '2026-06-01 17:33:17.925', '2026-06-01 17:33:17.925', 1, 'CANCEL_WORKER'),
(4, 4, 'WORKER', 1, 2, 1, NULL, 'Unsafe work condition', NULL, 100, 'PENDING', '2026-06-01 17:37:37.643', '2026-06-01 17:37:37.643', 0, 'CANCEL_DUTY'),
(5, 5, 'CLIENT', 2, 2, NULL, NULL, 'Wrong worker assigned', NULL, NULL, 'PENDING', '2026-06-01 17:39:26.370', '2026-06-01 17:39:26.370', 0, 'CANCEL_BOOKING'),
(6, 6, 'CLIENT', 2, 2, 1, NULL, 'Worker late hai', NULL, NULL, 'SOLVED', '2026-06-01 17:41:09.556', '2026-06-02 17:40:27.723', 1, 'CANCEL_WORKER'),
(7, 7, 'WORKER', 1, 2, 1, 1, 'Client phone receive nahi kar raha', NULL, 100, 'IN_PROGRESS', '2026-06-03 10:52:15.590', '2026-06-13 13:17:42.041', 0, 'CANCEL_DUTY'),
(8, 23, 'CLIENT', 2, 2, NULL, 1, 'Worker location par nahi aaya', NULL, NULL, 'PENDING', '2026-06-13 13:28:17.995', '2026-06-13 13:28:17.995', 0, 'CANCEL_BOOKING'),
(9, 24, 'CLIENT', 2, 2, 1, 1, 'Wrong worker assigned', NULL, NULL, 'PENDING', '2026-06-13 13:33:45.451', '2026-06-13 13:33:45.451', 1, 'CANCEL_WORKER'),
(10, 26, 'WORKER', 1, 2, 1, 1, 'Wrong location', NULL, 100, 'PENDING', '2026-06-13 13:46:44.736', '2026-06-13 13:46:44.736', 0, 'CANCEL_DUTY');

-- --------------------------------------------------------

--
-- Table structure for table `conflicttimeline`
--

CREATE TABLE `conflicttimeline` (
  `id` int NOT NULL,
  `conflictId` int NOT NULL,
  `updatedByType` enum('ADMIN','MITRA','SYSTEM') COLLATE utf8mb4_unicode_ci NOT NULL,
  `updatedById` int DEFAULT NULL,
  `oldStatus` enum('PENDING','IN_PROGRESS','SOLVED','UNRESOLVED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `newStatus` enum('PENDING','IN_PROGRESS','SOLVED','UNRESOLVED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `note` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `conflicttimeline`
--

INSERT INTO `conflicttimeline` (`id`, `conflictId`, `updatedByType`, `updatedById`, `oldStatus`, `newStatus`, `note`, `createdAt`) VALUES
(1, 1, 'SYSTEM', NULL, NULL, 'PENDING', 'Issue raised by WORKER. Reason: Client phone receive nahi kar raha. Action: CANCEL_DUTY. Continue work: No', '2026-06-01 17:30:08.644'),
(2, 2, 'SYSTEM', NULL, NULL, 'PENDING', 'Issue raised by CLIENT. Reason: Worker late hai. Action: CANCEL_BOOKING. Continue work: No', '2026-06-01 17:31:55.548'),
(3, 3, 'SYSTEM', NULL, NULL, 'PENDING', 'Issue raised by CLIENT. Reason: Wrong worker assigned. Action: CANCEL_WORKER. Continue work: Yes', '2026-06-01 17:33:17.927'),
(4, 4, 'SYSTEM', NULL, NULL, 'PENDING', 'Issue raised by WORKER. Reason: Unsafe work condition. Action: CANCEL_DUTY. Continue work: No', '2026-06-01 17:37:37.652'),
(5, 5, 'SYSTEM', NULL, NULL, 'PENDING', 'Issue raised by CLIENT. Reason: Wrong worker assigned. Action: CANCEL_BOOKING. Continue work: No', '2026-06-01 17:39:26.376'),
(6, 6, 'SYSTEM', NULL, NULL, 'PENDING', 'Issue raised by CLIENT. Reason: Worker late hai. Action: CANCEL_WORKER. Continue work: Yes', '2026-06-01 17:41:09.560'),
(7, 6, 'ADMIN', NULL, 'PENDING', 'IN_PROGRESS', 'test', '2026-06-02 17:39:40.270'),
(8, 6, 'ADMIN', NULL, 'IN_PROGRESS', 'IN_PROGRESS', 'From worker site conversation done', '2026-06-02 17:40:09.991'),
(9, 6, 'ADMIN', NULL, 'IN_PROGRESS', 'SOLVED', 'issue solve', '2026-06-02 17:40:27.726'),
(10, 7, 'SYSTEM', NULL, NULL, 'PENDING', 'Issue raised by WORKER. Reason: Client phone receive nahi kar raha. Action: CANCEL_DUTY. Continue work: No. Assigned Mitra ID: 1', '2026-06-03 10:52:15.593'),
(11, 7, 'MITRA', 1, 'PENDING', 'IN_PROGRESS', 'this is my first conflict', '2026-06-03 11:20:51.148'),
(12, 7, 'MITRA', 1, 'IN_PROGRESS', 'IN_PROGRESS', 'still pending', '2026-06-13 13:17:42.050'),
(13, 8, 'SYSTEM', NULL, NULL, 'PENDING', 'Issue raised by CLIENT. Reason: Worker location par nahi aaya. Action: CANCEL_BOOKING. Continue work: No. Assigned Mitra ID: 1', '2026-06-13 13:28:18.000'),
(14, 9, 'SYSTEM', NULL, NULL, 'PENDING', 'Issue raised by CLIENT. Reason: Wrong worker assigned. Action: CANCEL_WORKER. Continue work: Yes. Assigned Mitra ID: 1', '2026-06-13 13:33:45.455'),
(15, 10, 'SYSTEM', NULL, NULL, 'PENDING', 'Issue raised by WORKER. Reason: Wrong location. Action: CANCEL_DUTY. Continue work: No. Assigned Mitra ID: 1', '2026-06-13 13:46:44.738');

-- --------------------------------------------------------

--
-- Table structure for table `customer`
--

CREATE TABLE `customer` (
  `id` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otpExpiry` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `pushToken` text COLLATE utf8mb4_unicode_ci,
  `businessName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `businessType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isVerified` tinyint(1) NOT NULL DEFAULT '0',
  `siteAddress` text COLLATE utf8mb4_unicode_ci,
  `clientType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `gstNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `workerRequirement` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mitraId` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer`
--

INSERT INTO `customer` (`id`, `name`, `phone`, `email`, `otp`, `otpExpiry`, `createdAt`, `updatedAt`, `pushToken`, `businessName`, `businessType`, `isVerified`, `siteAddress`, `clientType`, `gstNumber`, `workerRequirement`, `mitraId`) VALUES
(1, 'Sarvesh Gandhere', '8369350353', 'sarveshgandhere2002-7@okaxis', NULL, NULL, '2026-05-12 09:46:56.758', '2026-05-22 14:35:28.760', 'ExponentPushToken[KgrLNSJ8AbQb5Ts4J5BFml]', NULL, NULL, 1, 'dombivli west\r\nold dombivli rpad', 'Individual', NULL, '15-50', 1),
(2, 'sarvesh gandhere', '8369552205', 'gandheresarvesh@gmail.com', NULL, NULL, '2026-05-12 09:57:34.864', '2026-06-21 18:01:04.397', 'ExponentPushToken[KgrLNSJ8AbQb5Ts4J5BFml]', NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL),
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
  `id` int NOT NULL,
  `customerId` int NOT NULL,
  `title` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fullName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `addressLine` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `landmark` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `city` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `state` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pincode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `longitude` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isDefault` tinyint(1) NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `cityId` int DEFAULT NULL,
  `nakaId` int DEFAULT NULL,
  `nakaName` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `addressDetail` text COLLATE utf8mb4_unicode_ci,
  `locationSource` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mapAddress` text COLLATE utf8mb4_unicode_ci,
  `placeId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL
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
  `id` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
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
  `id` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `photoUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `mitra`
--

INSERT INTO `mitra` (`id`, `name`, `phone`, `email`, `password`, `photoUrl`, `isActive`, `createdAt`, `updatedAt`) VALUES
(1, 'Sarvesh sanjay gandhere', '8369350353', 'mitra1@gmail.com', '$2b$10$9Y8BWkCG0CFw.M5W5tRFwe0VLUFD98567DAcKj7MFEaCjGcXr6yc.', NULL, 1, '2026-05-20 12:44:08.366', '2026-05-20 12:44:08.366');

-- --------------------------------------------------------

--
-- Table structure for table `naka`
--

CREATE TABLE `naka` (
  `id` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pincode` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` double DEFAULT NULL,
  `longitude` double DEFAULT NULL,
  `cityId` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `naka`
--

INSERT INTO `naka` (`id`, `name`, `pincode`, `latitude`, `longitude`, `cityId`, `createdAt`, `updatedAt`) VALUES
(1, 'Station East', '421202', NULL, NULL, 1, '2026-04-17 09:23:50.850', '2026-04-17 09:23:50.850'),
(2, 'Chakki naka', '421200', NULL, NULL, 2, '2026-04-17 13:11:06.614', '2026-04-17 13:11:06.614'),
(3, 'Chakki naka', '421202', NULL, NULL, 1, '2026-05-20 08:42:19.831', '2026-05-20 08:42:19.831'),
(4, 'kurla naka', '400004', NULL, NULL, 2, '2026-05-21 13:12:52.257', '2026-06-28 19:15:44.555'),
(5, 'test naka', '421200', NULL, NULL, 2, '2026-06-28 19:15:31.267', '2026-06-28 19:15:31.267'),
(6, 'Marol naka', '400014', 19.108413, 72.877845, 2, '2026-06-29 07:58:30.842', '2026-06-29 07:58:30.842');

-- --------------------------------------------------------

--
-- Table structure for table `rating`
--

CREATE TABLE `rating` (
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `workerId` int NOT NULL,
  `mehnat` int NOT NULL,
  `vyavhaar` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `rating`
--

INSERT INTO `rating` (`id`, `bookingId`, `workerId`, `mehnat`, `vyavhaar`, `createdAt`) VALUES
(6, 26, 1, 3, 5, '2026-05-17 09:57:06.690'),
(9, 1, 1, 4, 2, '2026-05-27 11:26:53.857'),
(10, 8, 1, 5, 5, '2026-06-08 06:01:56.116'),
(11, 11, 1, 3, 3, '2026-06-10 17:26:44.826'),
(12, 12, 1, 5, 5, '2026-06-10 17:30:41.451'),
(13, 13, 1, 4, 3, '2026-06-10 17:52:11.472'),
(14, 14, 1, 4, 3, '2026-06-10 17:53:59.177'),
(15, 16, 1, 2, 3, '2026-06-10 18:15:46.357'),
(16, 22, 1, 3, 5, '2026-06-12 06:51:11.992'),
(17, 25, 1, 4, 4, '2026-06-13 13:43:03.047'),
(18, 29, 1, 4, 4, '2026-06-21 18:07:51.483');

-- --------------------------------------------------------

--
-- Table structure for table `skill`
--

CREATE TABLE `skill` (
  `id` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `imageUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL
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
  `id` int NOT NULL,
  `skillId` int NOT NULL,
  `star` double NOT NULL,
  `rate` double NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
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
-- Table structure for table `worker`
--

CREATE TABLE `worker` (
  `id` int NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `dob` date NOT NULL,
  `age` int NOT NULL,
  `qualification` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `photoUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idProofType` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `idNumber` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `consentVoiceUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `pincode` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bankDetails` text COLLATE utf8mb4_unicode_ci,
  `upiId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `upiNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `isAvailable` tinyint(1) NOT NULL DEFAULT '0',
  `lastActive` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `pushToken` text COLLATE utf8mb4_unicode_ci,
  `mitraId` int DEFAULT NULL,
  `availabilityHours` int DEFAULT NULL,
  `availabilityStart` datetime(3) DEFAULT NULL,
  `availabilityType` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `availabilityUntil` datetime(3) DEFAULT NULL,
  `aadhaarNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `bmi` double DEFAULT NULL,
  `gender` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `heightCm` double DEFAULT NULL,
  `otherIdNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `panNumber` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `weightKg` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `worker`
--

INSERT INTO `worker` (`id`, `name`, `phone`, `email`, `password`, `dob`, `age`, `qualification`, `photoUrl`, `idProofType`, `idNumber`, `consentVoiceUrl`, `address`, `pincode`, `bankDetails`, `upiId`, `upiNumber`, `isActive`, `createdAt`, `updatedAt`, `isAvailable`, `lastActive`, `pushToken`, `mitraId`, `availabilityHours`, `availabilityStart`, `availabilityType`, `availabilityUntil`, `aadhaarNumber`, `bmi`, `gender`, `heightCm`, `otherIdNumber`, `panNumber`, `weightKg`) VALUES
(1, 'Vinit', '8369552205', 'vinit@gmail.com', '$2b$10$BBEczqOLw.Q0Mn4DgCIL9ODjbVvE7O.BatPMNOI/OIpzl0m/CEG.C', '2005-05-20', 20, NULL, NULL, 'AADHAR', '1234567891234', '/uploads/voice/1776418004591-527175489.MP3', '002, sharvari A wing, Kailash nagar, Old dombivli road, near suswagatam bar\r\nsharvari A- wing', '421202', 'DNS0000123', 'sarveshgandhere2002@gmail.com', '8369350353', 1, '2026-04-17 09:26:44.743', '2026-06-21 18:06:56.623', 0, '2026-06-21 18:03:44.049', 'ExponentPushToken[Zq-SZrJLq65P60GCkwurib]', NULL, NULL, '2026-06-21 18:03:44.049', 'FULL_DAY', '2026-06-21 18:29:00.000', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
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
  `id` int NOT NULL,
  `bookingId` int NOT NULL,
  `workerId` int NOT NULL,
  `customerId` int NOT NULL,
  `rating` int NOT NULL,
  `behaviour` int DEFAULT NULL,
  `locationAccuracy` int DEFAULT NULL,
  `coordination` int DEFAULT NULL,
  `comment` text COLLATE utf8mb4_unicode_ci,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `workerclientrating`
--

INSERT INTO `workerclientrating` (`id`, `bookingId`, `workerId`, `customerId`, `rating`, `behaviour`, `locationAccuracy`, `coordination`, `comment`, `createdAt`, `updatedAt`) VALUES
(1, 12, 1, 2, 3, 2, 4, 4, 'Testing', '2026-06-10 17:29:14.040', '2026-06-10 17:29:14.040'),
(2, 13, 1, 2, 5, 5, 5, 5, 'Chv', '2026-06-10 17:52:21.074', '2026-06-10 17:52:21.074'),
(3, 14, 1, 2, 5, 5, 5, 5, 'Testfxvfchxhchc xychch hchch hcy', '2026-06-10 17:54:18.633', '2026-06-10 17:54:18.633'),
(4, 16, 1, 2, 5, 5, 5, 5, 'Fhv', '2026-06-10 18:15:55.737', '2026-06-10 18:15:55.737'),
(5, 25, 1, 2, 5, 5, 5, 5, 'Hcjcjcjxhxh', '2026-06-13 13:42:46.804', '2026-06-13 13:42:46.804'),
(6, 29, 1, 2, 3, 5, 5, 5, NULL, '2026-06-21 18:06:44.667', '2026-06-21 18:06:44.667');

-- --------------------------------------------------------

--
-- Table structure for table `_bookingtoworker`
--

CREATE TABLE `_bookingtoworker` (
  `A` int NOT NULL,
  `B` int NOT NULL
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
(6, 1),
(7, 1),
(8, 1),
(9, 1),
(10, 1),
(11, 1),
(12, 1),
(13, 1),
(14, 1),
(15, 1),
(16, 1),
(17, 1),
(18, 1),
(19, 1),
(20, 1),
(21, 1),
(22, 1),
(23, 1),
(24, 1),
(25, 1),
(26, 1),
(27, 1),
(28, 1),
(29, 1);

-- --------------------------------------------------------

--
-- Table structure for table `_mitratonaka`
--

CREATE TABLE `_mitratonaka` (
  `A` int NOT NULL,
  `B` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `_mitratonaka`
--

INSERT INTO `_mitratonaka` (`A`, `B`) VALUES
(1, 1),
(1, 2),
(1, 3);

-- --------------------------------------------------------

--
-- Table structure for table `_nakatoworker`
--

CREATE TABLE `_nakatoworker` (
  `A` int NOT NULL,
  `B` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `_nakatoworker`
--

INSERT INTO `_nakatoworker` (`A`, `B`) VALUES
(1, 1),
(1, 2),
(2, 2),
(3, 2),
(1, 5),
(2, 5),
(3, 5),
(1, 6),
(2, 6),
(3, 6),
(2, 7),
(2, 9),
(1, 10),
(2, 10),
(2, 11);

-- --------------------------------------------------------

--
-- Table structure for table `_skilltoworker`
--

CREATE TABLE `_skilltoworker` (
  `A` int NOT NULL,
  `B` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `_skilltoworker`
--

INSERT INTO `_skilltoworker` (`A`, `B`) VALUES
(1, 1),
(1, 2),
(2, 2),
(3, 2),
(1, 5),
(2, 5),
(3, 5),
(1, 6),
(2, 6),
(3, 6),
(1, 7),
(2, 7),
(3, 7),
(1, 9),
(2, 9),
(3, 9),
(1, 10),
(2, 10),
(2, 11);

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
  ADD KEY `Booking_customerId_fkey` (`customerId`);

--
-- Indexes for table `city`
--
ALTER TABLE `city`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `City_name_key` (`name`);

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
  ADD KEY `Naka_cityId_fkey` (`cityId`);

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
  ADD UNIQUE KEY `_BookingToWorker_AB_unique` (`A`,`B`),
  ADD KEY `_BookingToWorker_B_index` (`B`);

--
-- Indexes for table `_mitratonaka`
--
ALTER TABLE `_mitratonaka`
  ADD UNIQUE KEY `_MitraToNaka_AB_unique` (`A`,`B`),
  ADD KEY `_MitraToNaka_B_index` (`B`);

--
-- Indexes for table `_nakatoworker`
--
ALTER TABLE `_nakatoworker`
  ADD UNIQUE KEY `_NakaToWorker_AB_unique` (`A`,`B`),
  ADD KEY `_NakaToWorker_B_index` (`B`);

--
-- Indexes for table `_skilltoworker`
--
ALTER TABLE `_skilltoworker`
  ADD UNIQUE KEY `_SkillToWorker_AB_unique` (`A`,`B`),
  ADD KEY `_SkillToWorker_B_index` (`B`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `booking`
--
ALTER TABLE `booking`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `city`
--
ALTER TABLE `city`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `conflict`
--
ALTER TABLE `conflict`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `conflicttimeline`
--
ALTER TABLE `conflicttimeline`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `customer`
--
ALTER TABLE `customer`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `customeraddress`
--
ALTER TABLE `customeraddress`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `employee`
--
ALTER TABLE `employee`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `mitra`
--
ALTER TABLE `mitra`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `naka`
--
ALTER TABLE `naka`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `rating`
--
ALTER TABLE `rating`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `skill`
--
ALTER TABLE `skill`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `skillrate`
--
ALTER TABLE `skillrate`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `worker`
--
ALTER TABLE `worker`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `workerclientrating`
--
ALTER TABLE `workerclientrating`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `booking`
--
ALTER TABLE `booking`
  ADD CONSTRAINT `Booking_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `conflict`
--
ALTER TABLE `conflict`
  ADD CONSTRAINT `Conflict_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `booking` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `conflicttimeline`
--
ALTER TABLE `conflicttimeline`
  ADD CONSTRAINT `ConflictTimeline_conflictId_fkey` FOREIGN KEY (`conflictId`) REFERENCES `conflict` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `customer`
--
ALTER TABLE `customer`
  ADD CONSTRAINT `Customer_mitraId_fkey` FOREIGN KEY (`mitraId`) REFERENCES `mitra` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `customeraddress`
--
ALTER TABLE `customeraddress`
  ADD CONSTRAINT `CustomerAddress_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customer` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `naka`
--
ALTER TABLE `naka`
  ADD CONSTRAINT `Naka_cityId_fkey` FOREIGN KEY (`cityId`) REFERENCES `city` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `rating`
--
ALTER TABLE `rating`
  ADD CONSTRAINT `Rating_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `booking` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `skillrate`
--
ALTER TABLE `skillrate`
  ADD CONSTRAINT `SkillRate_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `skill` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `worker`
--
ALTER TABLE `worker`
  ADD CONSTRAINT `Worker_mitraId_fkey` FOREIGN KEY (`mitraId`) REFERENCES `mitra` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `workerclientrating`
--
ALTER TABLE `workerclientrating`
  ADD CONSTRAINT `WorkerClientRating_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `booking` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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

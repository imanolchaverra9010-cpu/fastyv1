SET FOREIGN_KEY_CHECKS=0;
-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3306
-- Tiempo de generación: 29-04-2026 a las 03:31:03
-- Versión del servidor: 11.8.6-MariaDB-log
-- Versión de PHP: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `u659323332_fasty`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `businesses`
--

CREATE TABLE `businesses` (
  `id` varchar(50) NOT NULL,
  `owner_id` int(11) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `rating` decimal(3,2) DEFAULT 0.00,
  `emoji` varchar(10) DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `delivery_fee` int(11) DEFAULT 0,
  `eta` varchar(20) DEFAULT NULL,
  `status` enum('active','inactive','pending') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `business_requests`
--

CREATE TABLE `business_requests` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `address` varchar(255) NOT NULL,
  `category` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `menu_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`menu_json`)),
  `password` varchar(255) DEFAULT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `image_url` varchar(500) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `couriers`
--

CREATE TABLE `couriers` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `vehicle` varchar(50) DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `status` enum('online','busy','offline') DEFAULT 'offline',
  `lat` decimal(10,8) DEFAULT NULL,
  `lng` decimal(11,8) DEFAULT NULL,
  `rating` decimal(3,2) DEFAULT 5.00,
  `deliveries` int(11) DEFAULT 0,
  `earnings` int(11) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `couriers`
--

INSERT INTO `couriers` (`id`, `user_id`, `name`, `phone`, `vehicle`, `image_url`, `status`, `lat`, `lng`, `rating`, `deliveries`, `earnings`) VALUES
(1, 2, 'Joed Daniel', '3147323819', 'Moto', 'https://res.cloudinary.com/dpcdaw9uu/image/upload/v1777263580/fasty/profiles/f4e75c3e.png', 'online', 5.68127446, -76.64989444, 5.00, 6, 0),
(2, 4, 'Diego moreno rentería', '3217414498', 'Moto', NULL, 'online', NULL, NULL, 5.00, 0, 0),
(3, 5, 'Jhon Fredy Valencia Cuesta', '3108255465', 'Moto', NULL, 'online', NULL, NULL, 5.00, 0, 0),
(4, 6, 'Jonatan Santos Ramírez', '3134157991', 'Moto', 'https://res.cloudinary.com/dpcdaw9uu/image/upload/v1777382491/fasty/profiles/2672a289.jpg', 'online', NULL, NULL, 5.00, 0, 0),
(5, 7, 'Juan David Mena Palacios', '1111111111', 'Moto', NULL, 'online', NULL, NULL, 5.00, 0, 0),
(6, 8, 'Joed Daniel Cabezas Moreno', '3147323819', 'Moto', NULL, 'online', 5.68813566, -76.64367721, 5.00, 0, 0),
(7, 9, 'Daniel Moreno Renteria', '3042218031', 'Moto', 'https://res.cloudinary.com/dpcdaw9uu/image/upload/v1777294859/fasty/profiles/8774afb6.jpg', 'online', 5.68014650, -76.65228290, 5.00, 1, 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `menu_items`
--

CREATE TABLE `menu_items` (
  `id` int(11) NOT NULL,
  `business_id` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `price` int(11) NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `emoji` varchar(10) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `menu_items`
--

INSERT INTO `menu_items` (`id`, `business_id`, `name`, `description`, `price`, `category`, `image_url`, `emoji`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'cb856448', 'ala', 'ala con papas', 13000, 'Platos Principales', NULL, '🍗', 1, '2026-04-27 04:24:41', '2026-04-27 04:24:41'),
(2, '549ce593', 'Mangolé clásico 16 onzas ', 'Granizado de mango con lecherita, gomitas, borde michelado de Tajín y trocitos de mango picado encima ', 16000, 'Platos Principales', NULL, '🥤', 1, '2026-04-28 23:43:10', '2026-04-28 23:43:10'),
(5, '549ce593', 'Mangolé clásico 12 onzas ', 'Granizado de mango con lecherita, gomitas, borde michelado de Tajín y trocitos de mango picado encima ', 14000, 'Platos Principales', NULL, '🥤', 1, '2026-04-28 23:44:13', '2026-04-28 23:44:13'),
(6, '549ce593', 'Mangolé clásico 9 onzas ', 'Granizado de mango con lecherita, gomitas, borde michelado de Tajín y trocitos de mango picado encima ', 11000, 'Platos Principales', NULL, '🥤', 1, '2026-04-28 23:44:50', '2026-04-28 23:44:50');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `orders`
--

CREATE TABLE `orders` (
  `id` varchar(50) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `business_id` varchar(50) DEFAULT NULL,
  `customer_name` varchar(100) NOT NULL,
  `total` int(11) NOT NULL,
  `status` enum('pending','preparing','shipped','in_transit','delivered','cancelled') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `courier_id` int(11) DEFAULT NULL,
  `payment_method` enum('card','cash','wallet') DEFAULT 'card',
  `delivery_address` varchar(255) DEFAULT NULL,
  `customer_phone` varchar(20) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `cancellation_reason` text DEFAULT NULL,
  `estimated_delivery_time` timestamp NULL DEFAULT NULL,
  `order_type` enum('regular','open') DEFAULT 'regular',
  `origin_name` varchar(100) DEFAULT NULL,
  `origin_address` varchar(255) DEFAULT NULL,
  `open_order_description` text DEFAULT NULL,
  `is_rated` tinyint(1) DEFAULT 0,
  `batch_id` varchar(60) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `order_items`
--

CREATE TABLE `order_items` (
  `id` int(11) NOT NULL,
  `order_id` varchar(50) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `price` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `emoji` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `order_ratings`
--

CREATE TABLE `order_ratings` (
  `id` int(11) NOT NULL,
  `order_id` varchar(50) NOT NULL,
  `business_id` varchar(50) NOT NULL,
  `courier_id` int(11) DEFAULT NULL,
  `business_rating` int(11) NOT NULL CHECK (`business_rating` between 1 and 5),
  `courier_rating` int(11) DEFAULT NULL CHECK (`courier_rating` between 1 and 5),
  `comment` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `order_status_logs`
--

CREATE TABLE `order_status_logs` (
  `id` int(11) NOT NULL,
  `order_id` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `changed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `changed_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `promotions`
--

CREATE TABLE `promotions` (
  `id` int(11) NOT NULL,
  `business_id` varchar(50) NOT NULL,
  `title` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `discount_percent` int(11) DEFAULT NULL,
  `promo_code` varchar(20) DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `emoji` varchar(10) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `push_subscriptions`
--

CREATE TABLE `push_subscriptions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `subscription_json` text NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `push_subscriptions`
--

INSERT INTO `push_subscriptions` (`id`, `user_id`, `subscription_json`, `created_at`) VALUES
(1, 9, '{\"endpoint\": \"https://fcm.googleapis.com/fcm/send/cO_NvFkW6w0:APA91bFsLrOSFp46wRI_MlNPp5kOScgNPEWfKH9E1aQBB-ARoE5fZp6SSXdvSRTbGkXlbqyBzoEYgacl3GiH0x6sTlx7xy9NWzKz18mBNRkXFg0u7EPQrhY9yXO_4LXmAmXjxLWniXXu\", \"expirationTime\": null, \"keys\": {\"p256dh\": \"BFBXDU2WzVd2uv1Neg8xrCjH0Gj-tE8CJsLs4HsCxsNQ9Q-SR9yqWSEQiUG0jVHVmxY9h7vu2UFBFE9KdQote3c\", \"auth\": \"DMn8ImW2Ev1Lkx-N9MP0sw\"}}', '2026-04-27 12:55:44'),
(2, 12, '{\"endpoint\": \"https://fcm.googleapis.com/fcm/send/eJTaGpei_M0:APA91bES3gSlRELZWNSB4sP6md2TpjCtVaD24WUkJ6EQQzYP1q6o1C6zor8A_LX55eB_5z1t357bVHYSk4Zms-DJqn1K5aI1RM6j96j4QwFq_5tCaX5pnxLMrn-X8-mQ76ejJbLTlWDj\", \"expirationTime\": null, \"keys\": {\"p256dh\": \"BIcLCIlJGNvkpv7N2JChPxJ5ciWZpH4mAXrhtBVB7c_GeL6RQrt-jH4K3EDRrLn0UlTGFMD0cXCYxlczcZr6Xj0\", \"auth\": \"MmjwoSgVwQbPdntgf7lp2A\"}}', '2026-04-28 13:28:30'),
(3, 1, '{\"endpoint\": \"https://web.push.apple.com/QOWgT6jPQJKvkA9_DmsmmfRy-5wcszP-FP0f4c3FcFPuSXrqmpRZP7JfR44dXYDTrEQ_gGYyms8x4Lo7JQb0LX5It83oOMRQo_UTh58DJBPUKUoNl1tx0yrudIwRqHNLJAx8pbjCzuthWCJnbE3qWceue_ELA4dxoIamrfYmlCE\", \"keys\": {\"p256dh\": \"BJGs0Bb6TIrNZRMvUaawywSmq19Uv1D9GWvkrz838-C_p18P2bCC76qiEaWz6SmhRdbWfCB0PpYzJqgFtFe6rhA\", \"auth\": \"VHmHYncyljIGTk_CwpPbbQ\"}}', '2026-04-28 20:37:40'),
(4, 1, '{\"endpoint\": \"https://web.push.apple.com/QMpTjxIWuTupVlOq4M0W070rnuORiYqNt6k76SU_uYpU4Pq_BI0OTaGRPG6O2WAs6YnCHyWzVbJVC_B7CKRqKicvm87zZVubsFFN-o52WzoTe-d96yez0lhohMDXKgq9ZlhH0XiB-zKVgrPyowshaWcjjKwtolrU4npOJM2eMto\", \"keys\": {\"p256dh\": \"BIzjlhJ60Abte4yoeVIgEY0cMbF9vJdzUwEV_q5ntykuQctY9GqKW1ppACmFHVBaSH9_Ol-OAmLAWwusVPsF_to\", \"auth\": \"VKnUsSdvmU6c1jlmRlTBRg\"}}', '2026-04-28 22:52:14'),
(5, 11, '{\"endpoint\": \"https://fcm.googleapis.com/fcm/send/cSFTe96aoc4:APA91bGCeQ5Mm1gS2-MaoGKq14sYG16EMJo0kjkzRJkl7HMixcRr3wO-LHjD_egVVelPQdzizyG085em5yzUvBYstnlDMqzlhBB2rvlmhvk7rD19gnOERQvNefMMxnXS5gktKkjfbc7i\", \"expirationTime\": null, \"keys\": {\"p256dh\": \"BM0hxji_jEKlYbhdgRSwPXXBwdfRtjSfLg6S8WV1KKLaZO6dbZ3THzORup1dO6jDCz6Z-mMMeZ7ioDKxGvX9jCU\", \"auth\": \"u5WxoJ7pAfh-Uzhx0c0Ymg\"}}', '2026-04-28 23:35:11'),
(6, 6, '{\"endpoint\": \"https://fcm.googleapis.com/fcm/send/c6q7FQIswGk:APA91bEbTQOnapFKfF5plqkeLl2rJcvviUe3N9aMG5bklo7hypkY9uJd45TjbEOCSIf3x4EPmA2QectUnUWvzN3lYjDR3EOQw3Pqzg-8u9bB8JscjQLHS8OcWuJs2Hfv1VSxq_4NW6GN\", \"expirationTime\": null, \"keys\": {\"p256dh\": \"BIZn7Rp0ETh2zrlF-JiAlY34x7dGw4yteOMHnOqM0RFU1R1d4YOWT1FhaSm1UmQ6iO2-VHXV-z5q5tFnMc9yFe0\", \"auth\": \"YeA8KTYNC_TAAOmJwBRUew\"}}', '2026-04-28 23:44:14'),
(7, 8, '{\"endpoint\": \"https://web.push.apple.com/QLUkst51ZP5jCGa_2v1N3CuObxbNJHJUK0YQOHMQgpMD4vcPXwKwfzihexmrLuBSa1ao6MpLx-mbT_MQb-w7pO3mcQRtqtxvPE7febsT9-zIQZxbktH4XEleH3a2erbpZ2Kw97IesWQHYRp0Xmt7Zy24D7k2hsubBw1XBoQlO-U\", \"keys\": {\"p256dh\": \"BBnlL6BpzGNTU74tJvlEIgvE5Qt2fjRAYRZAxr9aCN2p_mELHFWn6Ho2YZhd2IDHsrqy2eoStgSr5VctFU0Ww_Q\", \"auth\": \"R_XkVDGw1nCnfEmQma2Btg\"}}', '2026-04-29 00:54:17');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `used_coupons`
--

CREATE TABLE `used_coupons` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `code` varchar(50) NOT NULL,
  `used_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `role` enum('admin','business','courier','customer') NOT NULL DEFAULT 'customer',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `provider` varchar(20) DEFAULT 'local',
  `provider_id` varchar(100) DEFAULT NULL,
  `avatar_url` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `role`, `created_at`, `provider`, `provider_id`, `avatar_url`) VALUES
(1, 'Jose_chaverra', 'josechaverra9010@fasty.com', '$2b$12$T20UJ9RYhQjthW9ya5uz2uXjJMRn3iAR4WcGynWaPGy9IOKDl63Pa', 'admin', '2026-04-26 19:24:12', 'local', NULL, NULL),
(2, 'Joed_Daniel', 'joeddaniel@fasty.com', '$2b$12$wiPJ29DDLpIGK8gVfgOmkuFpOUvwbaLJBLKEIHsvzOTo0wbg5HcCe', 'courier', '2026-04-27 01:09:41', 'local', NULL, NULL),
(3, 'pollosnacho6cef', 'imanolchaverra9010@gmail.com', '$2b$12$5Wa/E44EKoZjXem.BhnkfescRDDRky6FsyhJ/BIS04JR6cfy0GQpe', 'business', '2026-04-27 01:41:18', 'local', NULL, NULL),
(4, 'diego.moreno', 'd.morenor@fasty.com', '$2b$12$uzv4sVzDARl3mb9fmqKOqeQC0IrfvBtuDVlMYHJApseJ4QP4wpeqO', 'courier', '2026-04-27 04:04:34', 'local', NULL, NULL),
(5, 'jhon.fredy', 'j.valenciac@fasty.com', '$2b$12$cQnOJXr1aZ9wRXHE9jUhZ./TYXCszhDK8so9ekPZ3QWEPCvYtq9W2', 'courier', '2026-04-27 04:12:11', 'local', NULL, NULL),
(6, 'jonatan.santos', 'j.santosr@fasty.com', '$2b$12$PalgIiXUsccBkJES5oLtuezJpzOjKWtMjE8rnEdHLVfFNlqhHIt1q', 'courier', '2026-04-27 04:13:30', 'local', NULL, NULL),
(7, 'juan.david', 'j.menap@fasty.com', '$2b$12$yXKYrUo1P9UXXfel5lYb2ur6RVLdaPIWr2IDetOJW8sr9yA9hQtSK', 'courier', '2026-04-27 04:14:17', 'local', NULL, NULL),
(8, 'joed.daniel', 'j.cabezasm@fasty.com', '$2b$12$fukSEyLsuH5rOdVhSCZsHOTv23A064rtnq4Fv3qhB6U06Os6VEycK', 'courier', '2026-04-27 04:15:00', 'local', NULL, NULL),
(9, 'daniel.moreno', 'daniel.morenor@fasty.com', '$2b$12$OUXHciFllwVB2Vhx3F6OWuQB4sLhGDLuuw/sc7dJyT5OavAqAlzJK', 'courier', '2026-04-27 04:17:11', 'local', NULL, NULL),
(10, 'jose chaverra', 'josechaverra9010@gmail.com', NULL, 'customer', '2026-04-27 06:45:59', 'google', '103095079203985089867', 'https://lh3.googleusercontent.com/a/ACg8ocLbRkBDd7MX-5WPh2gx0ugl3A-_SahZYVX1T_Q-NelD2ctV0YYYLw=s96-c'),
(11, 'Jonatan Santos Ramirez (Shen long)', 'jonatan.jsr4@gmail.com', NULL, 'customer', '2026-04-27 13:07:08', 'google', '112924286634969916844', 'https://lh3.googleusercontent.com/a/ACg8ocLrsEyeCmCQMbEUF9vk632ibrCzcriETfCH97lfD09Q0UBHOPHpng=s96-c'),
(12, 'Angie Chaverra', 'chaverraa937@gmail.com', NULL, 'customer', '2026-04-28 13:28:19', 'google', '101975221239946557249', 'https://lh3.googleusercontent.com/a/ACg8ocKX_7ixUt6vsY7Hv5h5xTH7-9aVRiXxCKm8SOqrx6FWPzlhhQ=s96-c'),
(13, 'mangole9bd5', 'mangole@fasty.com', '$2b$12$5YQXQWzgHG7SIw.z8CRWbOg4qhvD6KAUT07BtG5XKe9C4jDSZNpPy', 'business', '2026-04-28 23:35:34', 'local', NULL, NULL),
(14, 'Gloribeth Mayo Morales', 'gmaymor90@gmail.com', NULL, 'customer', '2026-04-28 23:58:07', 'google', '115310160948968573625', 'https://lh3.googleusercontent.com/a/ACg8ocIy3ExNuEfa2ecUjFrGzKdnkgZSrRoKj0shDOuQfEp5arWRdhFGKg=s96-c');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `businesses`
--
ALTER TABLE `businesses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_business_owner` (`owner_id`);

--
-- Indices de la tabla `business_requests`
--
ALTER TABLE `business_requests`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `couriers`
--
ALTER TABLE `couriers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_courier_user` (`user_id`);

--
-- Indices de la tabla `menu_items`
--
ALTER TABLE `menu_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `business_id` (`business_id`);

--
-- Indices de la tabla `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `business_id` (`business_id`),
  ADD KEY `fk_courier` (`courier_id`),
  ADD KEY `idx_orders_batch_id` (`batch_id`);

--
-- Indices de la tabla `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indices de la tabla `order_ratings`
--
ALTER TABLE `order_ratings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `business_id` (`business_id`),
  ADD KEY `courier_id` (`courier_id`);

--
-- Indices de la tabla `order_status_logs`
--
ALTER TABLE `order_status_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indices de la tabla `promotions`
--
ALTER TABLE `promotions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `business_id` (`business_id`);

--
-- Indices de la tabla `push_subscriptions`
--
ALTER TABLE `push_subscriptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indices de la tabla `used_coupons`
--
ALTER TABLE `used_coupons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_code` (`user_id`,`code`);

--
-- Indices de la tabla `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `business_requests`
--
ALTER TABLE `business_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `couriers`
--
ALTER TABLE `couriers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de la tabla `menu_items`
--
ALTER TABLE `menu_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `order_ratings`
--
ALTER TABLE `order_ratings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `order_status_logs`
--
ALTER TABLE `order_status_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `promotions`
--
ALTER TABLE `promotions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `push_subscriptions`
--
ALTER TABLE `push_subscriptions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT de la tabla `used_coupons`
--
ALTER TABLE `used_coupons`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `businesses`
--
ALTER TABLE `businesses`
  ADD CONSTRAINT `fk_business_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`);

--
-- Filtros para la tabla `couriers`
--
ALTER TABLE `couriers`
  ADD CONSTRAINT `fk_courier_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Filtros para la tabla `menu_items`
--
ALTER TABLE `menu_items`
  ADD CONSTRAINT `menu_items_ibfk_1` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_courier` FOREIGN KEY (`courier_id`) REFERENCES `couriers` (`id`),
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`);

--
-- Filtros para la tabla `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`);

--
-- Filtros para la tabla `order_ratings`
--
ALTER TABLE `order_ratings`
  ADD CONSTRAINT `order_ratings_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  ADD CONSTRAINT `order_ratings_ibfk_2` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
  ADD CONSTRAINT `order_ratings_ibfk_3` FOREIGN KEY (`courier_id`) REFERENCES `couriers` (`id`);

--
-- Filtros para la tabla `order_status_logs`
--
ALTER TABLE `order_status_logs`
  ADD CONSTRAINT `order_status_logs_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`);

--
-- Filtros para la tabla `promotions`
--
ALTER TABLE `promotions`
  ADD CONSTRAINT `promotions_ibfk_1` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `push_subscriptions`
--
ALTER TABLE `push_subscriptions`
  ADD CONSTRAINT `push_subscriptions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `used_coupons`
--
ALTER TABLE `used_coupons`
  ADD CONSTRAINT `used_coupons_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

SET FOREIGN_KEY_CHECKS=1;

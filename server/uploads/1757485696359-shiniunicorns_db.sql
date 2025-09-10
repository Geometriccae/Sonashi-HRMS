-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 09, 2025 at 12:49 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `shiniunicorns_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `blog_posts`
--

CREATE TABLE `blog_posts` (
  `id` int(11) NOT NULL,
  `category` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `content` text DEFAULT NULL,
  `author` varchar(255) DEFAULT NULL,
  `comments` int(11) DEFAULT NULL,
  `date_published` date DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `blog_posts`
--

INSERT INTO `blog_posts` (`id`, `category`, `title`, `content`, `author`, `comments`, `date_published`, `image`) VALUES
(10, 'Ideathon', 'Ideathon', '', '', 0, '2024-01-09', '417148138_799558998644117_1207722446806324685_n.jpg'),
(13, 'Explore the unseen	', 'Explore the unseen	', '', '', 0, '2024-01-10', 'News_update_011.png'),
(17, 'Parichay', 'Parichay', '', '', 0, '2024-07-06', 'Black_and_Gold_Elegant_Graduation_Party_Poster_20240702_121902_0000.png');

-- --------------------------------------------------------

--
-- Table structure for table `contacts`
--

CREATE TABLE `contacts` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `contacts`
--

INSERT INTO `contacts` (`id`, `name`, `email`, `phone`, `subject`, `message`, `created_at`) VALUES
(12, 'Venkateshwaran Soorabathman', 'venkateshwaran2810@gmail.com', '9600449363', 'test', 'test', '2025-08-14 15:08:37');

-- --------------------------------------------------------

--
-- Table structure for table `events`
--

CREATE TABLE `events` (
  `id` int(11) NOT NULL,
  `event_title` varchar(255) NOT NULL,
  `event_description` text DEFAULT NULL,
  `event_location` varchar(255) DEFAULT NULL,
  `event_date` date DEFAULT NULL,
  `event_time` time DEFAULT NULL,
  `event_image_url` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `events`
--

INSERT INTO `events` (`id`, `event_title`, `event_description`, `event_location`, `event_date`, `event_time`, `event_image_url`) VALUES
(5, 'Ipsa dolorem magni ', 'Aliquid lorem dolore', 'Voluptate molestiae ', '1999-08-02', '10:27:00', 'Screenshot_2025-03-12_101615.png');

-- --------------------------------------------------------

--
-- Table structure for table `project_enquiries`
--

CREATE TABLE `project_enquiries` (
  `id` int(11) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `company_name` varchar(255) NOT NULL,
  `contact_number` varchar(50) NOT NULL,
  `email_address` varchar(255) NOT NULL,
  `location` text NOT NULL,
  `agricultural_products` text NOT NULL,
  `daily_quantity_kg` int(11) NOT NULL,
  `current_drying_method` text NOT NULL,
  `purpose_of_enquiry` text NOT NULL,
  `additional_message` text DEFAULT NULL,
  `created_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `project_enquiries`
--

INSERT INTO `project_enquiries` (`id`, `full_name`, `company_name`, `contact_number`, `email_address`, `location`, `agricultural_products`, `daily_quantity_kg`, `current_drying_method`, `purpose_of_enquiry`, `additional_message`, `created_at`) VALUES
(7, 'Venkateshwaran Soorabathman', 'building construction', '09600449363', 'venkateshwaran2810@gmail.com', 'T.Pudukkottai', 'Sit aliquam Nam id ', 2, 'Open Sun Drying', 'Looking to buy a solar greenhouse dryer', 'csc', '2025-08-13 12:55:03');

-- --------------------------------------------------------

--
-- Table structure for table `testimonials`
--

CREATE TABLE `testimonials` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `place` varchar(100) NOT NULL,
  `designation` varchar(100) DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `rating` int(1) DEFAULT 5,
  `content` text NOT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `testimonials`
--

INSERT INTO `testimonials` (`id`, `name`, `place`, `designation`, `image`, `rating`, `content`, `status`, `created_at`) VALUES
(23, 'Mr. Hari', 'Keerai Kadai Ventures Private Limited, Madurai', 'Incharge-Production', 'uploads/testimonials/fa7d25a1fccaa6903f43873f39cfb25f.jpeg', 5, 'At Keerai Kadai Ventures, our commitment to delivering , nutrient-rich greens inspired us to adopt the ShiniJet Agri Dryer. This solar-powered system allows us to gently preserve the essence of native greens—transforming them into powders and mixes without compromising purity. It’s a seamless fusion of tradition, innovation, and sustainability.', 'approved', '2025-08-14 13:51:02'),
(24, 'Manjula Flour Mills', 'Sulur, Coimbatore', 'Customer', 'uploads/testimonials/d35d75d11c810f20db5dd08a3c356c41.jpeg', 5, 'Shiniunicorns has helped us redefine our health mix production. Its solar-powered, hygienic drying ensures consistent quality and rich nutrition—meeting export standards with ease. The technology supports scalability and preserves product integrity, enabling us to confidently expand into global markets with authentic, shelf-stable, and value-added Indian health foods.', 'approved', '2025-08-14 13:52:11'),
(25, 'Venkateshwaran Soorabathman', 'Sivagangai', 'Customer', 'uploads/testimonials/96a57f15302793a4117e90043a1b62fa.jpeg', 5, 'Thankyou shiniunicorns.', 'approved', '2025-08-14 13:59:53'),
(29, 'Customer', 'Annur,Coimbatore', 'Vendhan Solar Dried Food Products', 'uploads/testimonials/8c2ef3459784234d3368760da9800afe.jpg', 5, 'Since installing the ShiniCab Agri Dryer, we’ve achieved fast, uniform, and hygienic solar drying of moringa, amla, banana stem, idly powder, and health mixes. It preserves nutrition, enhances shelf life, and slashes costs. Truly a sustainable game-changer -boosting quality and empowering small producers!” ', 'approved', '2025-09-08 12:05:19'),
(30, 'Rathina Balaji C', 'Virudhunagar, Tamil Nadu', '', 'uploads/testimonials/982b921c50f1a7ffb118f73a9fe605a4.jpg', 5, 'The ShiniCab Agri Dryer is a perfect choice for my home-based food business journey. Its solar-powered design offers  clean, efficient, and uniform drying. Easy to operate and cost-effective,it supports hygienic production and longer shelf life', 'approved', '2025-09-08 12:06:25'),
(31, 'Mr.Dhayanidhi', 'Coimbatore', 'Founder, Dcon Technologies', 'uploads/testimonials/2a9ecd469f4b0802c53b4ff5bb342860.jpg', 5, 'Partnering with Shini Unicorns Solar Tech has been a rewarding journey. Their ShiniCab and ShiniJet Agri Dryers deliver consistent, hygienic, solar-powered drying that meets real market needs. The technology is reliable, scalable, and eco-friendly—making it a strong value proposition for entrepreneurs and a profitable venture for distribution partners.', 'approved', '2025-09-08 12:07:26'),
(32, 'customer', 'Thoothukodi', 'Aahayathamarai Enterprise Group', 'uploads/testimonials/3bc8deb06aa47f299e74fe1cc760c778.jpg', 5, 'Drying water hyacinth was difficult and slow before. With the ShiniJet Agri Dryer, we dry it faster and cleaner. It helped us make better-quality products and increased our income. This dryer solved our problem and gave us a way to grow our small business with more confidence.', 'approved', '2025-09-08 12:10:06'),
(33, 'Customer', 'Virudhunagar', 'Mellow Bites', 'uploads/testimonials/604876c5d01b49785bb85c63ce491157.jpg', 5, 'We recently purchased a solar dryer from Shiniunicorns, and it has been a great addition to our processing unit. The dryer is efficient, user-friendly, and has helped us maintain the quality of our products while reducing drying time. We truly appreciate the team’s support and innovative solution.', 'approved', '2025-09-08 12:13:03');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `email_id` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL,
  `account_status` int(11) NOT NULL DEFAULT 0,
  `timestamp` int(11) NOT NULL DEFAULT 0,
  `mod_timestamp` int(11) NOT NULL DEFAULT 0,
  `type` varchar(255) DEFAULT 'admin',
  `full_name` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `first_name`, `last_name`, `email_id`, `password`, `role`, `account_status`, `timestamp`, `mod_timestamp`, `type`, `full_name`) VALUES
(13, 'admin', 'admin', 'admin@demo.com', '7c4a8d09ca3762af61e59520943dc26494f8941b', 'SUADMIN', 1, 0, 0, 'admin', 'admin admin'),
(14, 'user', 'user', 'user@demo.com', '7c4a8d09ca3762af61e59520943dc26494f8941b', 'SUADMIN', 1, 0, 0, 'user', 'user user'),
(19, 'admin', 'admin', 'admin123@demo.com', '23d42f5f3f66498b2c8ff4c20b8c5ac826e47146', 'SUADMIN', 1, 2147483647, 2147483647, 'admin', 'admin admin');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `blog_posts`
--
ALTER TABLE `blog_posts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `contacts`
--
ALTER TABLE `contacts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `events`
--
ALTER TABLE `events`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `project_enquiries`
--
ALTER TABLE `project_enquiries`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `testimonials`
--
ALTER TABLE `testimonials`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email_id` (`email_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `blog_posts`
--
ALTER TABLE `blog_posts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `contacts`
--
ALTER TABLE `contacts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `events`
--
ALTER TABLE `events`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `project_enquiries`
--
ALTER TABLE `project_enquiries`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `testimonials`
--
ALTER TABLE `testimonials`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

-- MySQL dump 10.13  Distrib 8.4.9, for Linux (x86_64)
--
-- Host: localhost    Database: ZenSpaceDB
-- ------------------------------------------------------
-- Server version	8.4.9

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `BaiDang`
--

DROP TABLE IF EXISTS `BaiDang`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `BaiDang` (
  `id` int NOT NULL AUTO_INCREMENT,
  `noiDung` mediumtext NOT NULL,
  `mediaUrl` varchar(255) DEFAULT NULL,
  `idTaiKhoan` int NOT NULL,
  `ngayTao` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idTaiKhoan` (`idTaiKhoan`),
  CONSTRAINT `BaiDang_ibfk_1` FOREIGN KEY (`idTaiKhoan`) REFERENCES `TaiKhoan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `BaiDang`
--

LOCK TABLES `BaiDang` WRITE;
/*!40000 ALTER TABLE `BaiDang` DISABLE KEYS */;
INSERT INTO `BaiDang` VALUES (1,'Chào mừng tới Zenpacia\n\nNơi bạn có thể đăng bài, vui chơi thoải mái\nHẹ hẹ hẹ',NULL,1,'2025-06-25 11:53:34'),(4,'Đánh giá\n\nWeb chx gì đã bị lỗi rồi',NULL,3,'2025-06-28 08:01:54'),(11,'Vạn hạnh mall xin mời các tử sĩ 2k7 ghé chơi\n\nCung cấp địa chỉ thằng ra đề văn toán',NULL,6,'2025-06-28 08:42:08'),(12,'Thử thách của Mr Bít\n\nMr Bít đang thử thách quay video bạn với Chubby Trà Bông sẽ có những hành động trên 18 tuổi trong vòng 24h\nNếu bạn thắng thử thách bạn sẽ nhận 1 tỷ Venezuela\nCòn chần chờ j nx mà ko đến Hải Phòng - nơi ban phát dân chủ aka thử thách Mr Beast vào 2001 giờ',NULL,4,'2025-06-28 09:25:43'),(13,'Web như con kẹt',NULL,7,'2025-06-28 10:06:01'),(15,'xin lỗi , web b tuyệt vời lắm 😔\n\n🙂🙂',NULL,9,'2025-06-28 11:39:16'),(16,'👽 bị lộ rồi\n\nbị lộ rồi',NULL,9,'2025-06-28 11:40:35'),(17,'góp ý\n\ntính năng thả icon ch ổn nha fen, thả xong mà cứ load lại trang :v',NULL,11,'2025-06-28 12:23:06'),(18,'Web lồn sửa hoài đéo hết lỗi\n\nLồn mẹ',NULL,1,'2025-06-28 18:20:06'),(19,'This is the official fanpage of Cristiano Ronaldo\n\nHi guys, I\'m Cristiano Ronaldo. Messi and I are best friends and always compete positively.',NULL,12,'2025-06-29 04:36:39'),(20,'Ronaldoooooo\n\nSiuuuuuuuuuuuuuuuu',NULL,12,'2025-06-29 04:39:14'),(21,'To Messi\n\nI wonder if Messi uses this platform? I just wanted to say your wife was amazing last night.',NULL,12,'2025-06-29 04:42:09');
/*!40000 ALTER TABLE `BaiDang` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Cam_Xuc`
--

DROP TABLE IF EXISTS `Cam_Xuc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Cam_Xuc` (
  `id` int NOT NULL AUTO_INCREMENT,
  `idBaiDang` int NOT NULL,
  `idTaiKhoan` int NOT NULL,
  `loaiCamXuc` enum('like','dislike','love','haha','wow','sad','angry') NOT NULL,
  `ngayCamXuc` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idBaiDang` (`idBaiDang`,`idTaiKhoan`),
  KEY `idTaiKhoan` (`idTaiKhoan`),
  CONSTRAINT `cam_xuc_ibfk_1` FOREIGN KEY (`idBaiDang`) REFERENCES `BaiDang` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cam_xuc_ibfk_2` FOREIGN KEY (`idTaiKhoan`) REFERENCES `TaiKhoan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Cam_Xuc`
--

LOCK TABLES `Cam_Xuc` WRITE;
/*!40000 ALTER TABLE `Cam_Xuc` DISABLE KEYS */;
INSERT INTO `Cam_Xuc` VALUES (1,1,1,'like','2025-06-25 11:54:22'),(9,4,1,'angry','2025-06-28 08:02:58'),(14,11,1,'sad','2025-06-28 08:42:16'),(19,11,6,'haha','2025-06-28 08:44:56'),(21,1,8,'love','2025-06-28 10:39:36'),(22,13,1,'angry','2025-06-28 10:55:42'),(23,12,1,'wow','2025-06-28 10:56:38'),(26,13,11,'haha','2025-06-28 12:21:59'),(27,15,11,'haha','2025-06-28 12:22:02'),(29,12,11,'love','2025-06-28 12:22:12'),(30,16,11,'love','2025-06-28 12:22:14'),(31,17,1,'wow','2025-06-28 18:01:16'),(32,18,1,'angry','2025-06-28 18:20:09'),(33,19,1,'haha','2025-06-29 04:39:14'),(34,21,13,'angry','2026-10-10 15:16:01'),(35,20,13,'angry','2026-10-14 16:01:14'),(38,18,13,'haha','2026-10-14 16:28:37');
/*!40000 ALTER TABLE `Cam_Xuc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `TaiKhoan`
--

DROP TABLE IF EXISTS `TaiKhoan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `TaiKhoan` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenDangNhap` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `matKhau` varchar(255) NOT NULL,
  `avatar` longtext,
  `phanQuyen` varchar(20) DEFAULT 'user',
  `ngayTao` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenDangNhap` (`tenDangNhap`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `TaiKhoan`
--

LOCK TABLES `TaiKhoan` WRITE;
/*!40000 ALTER TABLE `TaiKhoan` DISABLE KEYS */;
INSERT INTO `TaiKhoan` VALUES (1,'TuanQuang08','tuantqtb01555@gmail.com','Tuan@1234','IMG/ZenUser.png','admin','2025-06-25 11:53:12'),(2,'làtaonef','hunghoangff678@gmail.com','123','IMG/ZenUser.png','user','2025-06-28 07:59:21'),(3,'ZenSS','leducanh6908@gmail.com','1234567809qw','IMG/ZenUser.png','user','2025-06-28 08:01:31'),(4,'Thành Luke','cahoihoang955@gmail.com','vclchx123','IMG/ZenUser.png','user','2025-06-28 08:20:02'),(5,'Quynhtram22','chikhoiphamle@gmail.com','123456','IMG/ZenUser.png','user','2025-06-28 08:23:26'),(6,'Anbatocom','testerbanhmiramram@gmail.com','123456789','IMG/ZenUser.png','user','2025-06-28 08:39:29'),(7,'Maminhquan','tuan@gmail.com','Conma11062008@','IMG/ZenUser.png','user','2025-06-28 10:05:26'),(8,'Khuongnguyen','nttkhuong@gmail.com','123456','IMG/ZenUser.png','user','2025-06-28 10:39:14'),(9,'tunbiettaok','123@gmail.com','123','IMG/ZenUser.png','user','2025-06-28 11:03:05'),(10,'Tranminh','tranhuuminh.bh@gmail.com','12344321','IMG/ZenUser.png','user','2025-06-28 11:28:50'),(11,'Khánh','dqk2092008@gmail.com','1','IMG/ZenUser.png','user','2025-06-28 12:21:44'),(12,'Cristiano Ronaldo','taolafanngot@gmail.com','cristianoronaldo','IMG/ZenUser.png','admin','2025-06-29 04:34:03'),(13,'Tuấn đẹp trai','gerbil5082832@mailshan.com','$2a$10$X.NTSHD2lsvbJRxQpaY1FO9OvFGeE/xYWeWbw.LDT5hXiph70guF.','IMG/ZenUser.png','user','2026-10-10 15:15:52');
/*!40000 ALTER TABLE `TaiKhoan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `binhluan`
--

DROP TABLE IF EXISTS `binhluan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `binhluan` (
  `id` int NOT NULL AUTO_INCREMENT,
  `idBaiDang` int NOT NULL,
  `idTaiKhoan` int NOT NULL,
  `noiDung` text NOT NULL,
  `ngayBinhLuan` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idBaiDang` (`idBaiDang`),
  KEY `idTaiKhoan` (`idTaiKhoan`),
  CONSTRAINT `binhluan_ibfk_1` FOREIGN KEY (`idBaiDang`) REFERENCES `BaiDang` (`id`) ON DELETE CASCADE,
  CONSTRAINT `binhluan_ibfk_2` FOREIGN KEY (`idTaiKhoan`) REFERENCES `TaiKhoan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=46 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `binhluan`
--

LOCK TABLES `binhluan` WRITE;
/*!40000 ALTER TABLE `binhluan` DISABLE KEYS */;
INSERT INTO `binhluan` VALUES (2,1,1,'Hẹ hẹ hẹ','2025-06-28 07:32:54'),(4,1,3,'Chưa gì đã lỗi. Chẹp chẹp','2025-06-28 08:02:32'),(5,1,3,'Phốt thôi (\")>','2025-06-28 08:03:03'),(6,4,1,'Mới lần đầu anh em bỏ qua cho nhau tí đê','2025-06-28 08:03:14'),(7,4,4,'Đroi đó bro','2025-06-28 08:22:00'),(30,11,1,'vcl','2025-06-28 08:43:07'),(31,11,1,'Đâu ? Thằng ra đề toán đâu','2025-06-28 08:43:17'),(32,11,4,'is me','2025-06-28 09:17:47'),(33,11,4,'Tham khảo từ đề bên Trung Quốc','2025-06-28 09:18:06'),(34,11,4,'Thực ra đề tiếng anh đó là tôi đánh tráo bên IELST ;)','2025-06-28 09:18:46'),(36,13,1,'M nhớ nha mày','2025-06-28 10:55:50'),(37,13,1,'Nay m chê web của t, mốt t vô web Hago tree t đánh cho còn 1 sao nè','2025-06-28 10:56:08'),(38,13,4,'Bro sao lỡ lòng nào nói z vậy bro :)))))','2025-06-28 11:02:16'),(41,17,1,'oke','2025-06-28 18:03:48'),(42,18,1,'cccccccccccccccccc','2025-06-28 18:20:13'),(44,21,13,'con mẹ nó','2026-10-14 16:28:57'),(45,21,13,'ùm6','2026-10-14 17:56:15');
/*!40000 ALTER TABLE `binhluan` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `follows`
--

DROP TABLE IF EXISTS `follows`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `follows` (
  `follower_id` int NOT NULL,
  `following_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`follower_id`,`following_id`),
  KEY `idx_follows_following` (`following_id`),
  CONSTRAINT `follows_ibfk_1` FOREIGN KEY (`follower_id`) REFERENCES `TaiKhoan` (`id`) ON DELETE CASCADE,
  CONSTRAINT `follows_ibfk_2` FOREIGN KEY (`following_id`) REFERENCES `TaiKhoan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `follows`
--

LOCK TABLES `follows` WRITE;
/*!40000 ALTER TABLE `follows` DISABLE KEYS */;
INSERT INTO `follows` VALUES (13,12,'2026-10-14 17:09:32');
/*!40000 ALTER TABLE `follows` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schema_migrations`
--

DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `version` varchar(100) NOT NULL,
  `applied_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schema_migrations`
--

LOCK TABLES `schema_migrations` WRITE;
/*!40000 ALTER TABLE `schema_migrations` DISABLE KEYS */;
INSERT INTO `schema_migrations` VALUES ('20261015_content_only_posts','2026-10-15 03:04:39');
/*!40000 ALTER TABLE `schema_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tin_nhan`
--

DROP TABLE IF EXISTS `tin_nhan`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tin_nhan` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nguoi_gui_id` int NOT NULL,
  `nguoi_nhan_id` int NOT NULL,
  `noi_dung` text NOT NULL,
  `thoi_gian` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nguoi_gui_id` (`nguoi_gui_id`),
  KEY `nguoi_nhan_id` (`nguoi_nhan_id`),
  CONSTRAINT `tin_nhan_ibfk_1` FOREIGN KEY (`nguoi_gui_id`) REFERENCES `TaiKhoan` (`id`) ON DELETE CASCADE,
  CONSTRAINT `tin_nhan_ibfk_2` FOREIGN KEY (`nguoi_nhan_id`) REFERENCES `TaiKhoan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tin_nhan`
--

LOCK TABLES `tin_nhan` WRITE;
/*!40000 ALTER TABLE `tin_nhan` DISABLE KEYS */;
/*!40000 ALTER TABLE `tin_nhan` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-15  3:29:51

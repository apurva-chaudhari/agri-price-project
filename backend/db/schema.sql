-- AgriPrice Vision Database Schema
-- Run: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS agri_price_db;
USE agri_price_db;

-- ---------------------------------------------------------
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('farmer', 'broker', 'admin') DEFAULT 'farmer',
  phone VARCHAR(20),
  location_lat DECIMAL(10, 6),
  location_lng DECIMAL(10, 6),
  market_id INT NULL, -- set for brokers: which APMC/market they represent
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
CREATE TABLE markets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  district VARCHAR(100),
  state VARCHAR(100),
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL
);

ALTER TABLE users ADD CONSTRAINT fk_users_market FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE SET NULL;

-- ---------------------------------------------------------
CREATE TABLE commodities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(50),
  unit VARCHAR(20) DEFAULT 'quintal',
  imagenet_labels TEXT -- comma-separated MobileNet/ImageNet labels mapped to this crop
);

-- ---------------------------------------------------------
CREATE TABLE price_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  commodity_id INT NOT NULL,
  market_id INT NOT NULL,
  min_price DECIMAL(10, 2) NOT NULL,
  max_price DECIMAL(10, 2) NOT NULL,
  modal_price DECIMAL(10, 2) NOT NULL,
  arrival_qty DECIMAL(10, 2) DEFAULT 0,
  price_date DATE NOT NULL,
  FOREIGN KEY (commodity_id) REFERENCES commodities(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE,
  INDEX idx_commodity_date (commodity_id, price_date)
);

-- ---------------------------------------------------------
CREATE TABLE uploads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  image_path VARCHAR(255) NOT NULL,
  predicted_commodity VARCHAR(100),
  confidence DECIMAL(5, 2),
  quality_grade ENUM('A', 'B', 'C') DEFAULT 'B',
  quality_score DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- Broker-uploaded reference photos that DEFINE what Grade A/B/C looks like
-- for a given commodity, at a given market. A farmer's photo is matched
-- against these (by image-embedding similarity) instead of an independent
-- AI opinion — so the grade the app shows is calibrated to what the actual
-- broker at that mandi will say, not an abstract standard.
CREATE TABLE grade_references (
  id INT AUTO_INCREMENT PRIMARY KEY,
  market_id INT NOT NULL,
  commodity_id INT NOT NULL,
  broker_id INT NOT NULL,
  grade ENUM('A', 'B', 'C') NOT NULL,
  image_path VARCHAR(255) NOT NULL,
  embedding LONGTEXT NOT NULL, -- JSON array: MobileNet feature embedding of this reference photo
  notes VARCHAR(255), -- e.g. "no stones/sticks/husk" for Grade A chana
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE,
  FOREIGN KEY (commodity_id) REFERENCES commodities(id) ON DELETE CASCADE,
  FOREIGN KEY (broker_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_reference (market_id, commodity_id, grade) -- one active reference per grade; re-uploading replaces it
);

-- ---------------------------------------------------------
-- Broker-set price per grade, updated daily. This is what actually
-- determines what a farmer's graded crop is worth — not a synthetic
-- modal-price-times-multiplier guess.
CREATE TABLE grade_prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  market_id INT NOT NULL,
  commodity_id INT NOT NULL,
  broker_id INT NOT NULL,
  grade ENUM('A', 'B', 'C') NOT NULL,
  price DECIMAL(10, 2) NOT NULL, -- per quintal
  price_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE,
  FOREIGN KEY (commodity_id) REFERENCES commodities(id) ON DELETE CASCADE,
  FOREIGN KEY (broker_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_grade_price_per_day (market_id, commodity_id, grade, price_date)
);

-- ---------------------------------------------------------
CREATE TABLE forecasts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  commodity_id INT NOT NULL,
  market_id INT NOT NULL,
  forecast_date DATE NOT NULL,
  predicted_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (commodity_id) REFERENCES commodities(id) ON DELETE CASCADE,
  FOREIGN KEY (market_id) REFERENCES markets(id) ON DELETE CASCADE
);

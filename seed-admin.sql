INSERT INTO users (username, password, "fullName", role, "isActive", "totalXP", level, "testsCompleted", "zikrCount", "lastActiveAt")
VALUES (
  'Ziyodulloh',
  '$2a$12$VVmcbLAqHU3AVJUbYjb4.ON.HIJiAns9pQ913shJQk7r1bksMppqW',
  'Ziyodulloh (Admin)',
  'ADMIN',
  true,
  0,
  1,
  0,
  0,
  NOW()
)
ON CONFLICT (username) DO UPDATE SET
  password = '$2a$12$VVmcbLAqHU3AVJUbYjb4.ON.HIJiAns9pQ913shJQk7r1bksMppqW',
  role = 'ADMIN',
  "isActive" = true;

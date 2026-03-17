# Script to update all product images to a new URL
import sqlite3
import os

# Database path
db_path = os.path.join(os.path.dirname(__file__), '..', 'backend', 'devdata', 'westernpumps.db')
db_path = os.path.abspath(db_path)

# New image URL
new_image_url = "https://images.pexels.com/photos/31161427/pexels-photo-31161427.jpeg"

print(f"Database: {db_path}")
print(f"Updating products with new image: {new_image_url}")
print()

# Connect to database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# First, let's see what columns exist for images
cursor.execute("PRAGMA table_info(parts)")
columns = cursor.fetchall()
print("Table columns:")
for col in columns:
    print(f"  - {col[1]} ({col[2]})")

print()

# Find image-related columns
image_columns = []
for col in columns:
    if 'image' in col[1].lower() or 'photo' in col[1].lower() or 'url' in col[1].lower() or 'picture' in col[1].lower():
        image_columns.append(col[1])

print(f"Image-related columns found: {image_columns}")
print()

# Update each image column
if image_columns:
    for col in image_columns:
        # Get current count
        cursor.execute(f"SELECT COUNT(*) FROM parts WHERE {col} IS NOT NULL AND {col} != ''")
        count = cursor.fetchone()[0]
        print(f"Updating column '{col}': {count} products have images")
        
        # Update all products with the new image URL
        cursor.execute(f"UPDATE parts SET {col} = ? WHERE {col} IS NOT NULL AND {col} != ''", (new_image_url,))
        
    conn.commit()
    print()
    print("Products updated successfully!")
else:
    print("No image columns found in parts table!")

# Show some sample data
print()
print("Sample products after update:")
cursor.execute("SELECT id, name, image_url FROM parts LIMIT 5")
for row in cursor.fetchall():
    print(f"  ID: {row[0]}, Name: {row[1]}, Image: {row[2]}")

conn.close()

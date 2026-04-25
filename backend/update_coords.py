from database import get_db
db = get_db()
cursor = db.cursor()
cursor.execute("UPDATE businesses SET latitude = 4.6533, longitude = -74.0836 WHERE id = '1'")
cursor.execute("UPDATE businesses SET latitude = 4.6612, longitude = -74.0736 WHERE id = '2'")
cursor.execute("UPDATE businesses SET latitude = 4.6712, longitude = -74.0636 WHERE id = '3'")
db.commit()
db.close()
print("Done")

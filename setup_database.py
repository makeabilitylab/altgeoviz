import duckdb

def setup_database(db_path):

    con = duckdb.connect(database=db_path, read_only=False)
    
    if 'spatial' not in con.execute("SELECT * FROM duckdb_extensions()").fetchall():
        con.execute("INSTALL 'spatial';")
        con.execute("LOAD 'spatial';")
    
    # Optionally, here you can also create tables, load data, or perform any other setup tasks.
    con.close()

if __name__ == "__main__":
    setup_database('data/my_spatial_db.duckdb')


def check_spatial_extension(db_path):
    con = duckdb.connect(database=db_path)
    extensions_loaded = con.execute("SELECT * FROM duckdb_extensions()").fetchall()
    con.close()
    return 'spatial' in (ext[0] for ext in extensions_loaded)

if __name__ == "__main__":
    db_path = 'data/my_spatial_db.duckdb'
    if check_spatial_extension(db_path):
        print("Spatial extension is loaded.")
    else:
        print("Spatial extension is NOT loaded.")

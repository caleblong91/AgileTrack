#!/usr/bin/env python3

from sqlalchemy import create_engine, Column, Integer, ForeignKey
from sqlalchemy.sql import text
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get database URL from environment
database_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/agiletrack")

# Create engine
engine = create_engine(database_url)

def alter_table_add_column(table_name, column_name, column_type, nullable=True, foreign_key=None):
    """Add a column to an existing table if it doesn't exist"""
    
    # Check if column exists
    check_column_sql = text(f"""
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = '{table_name}' AND column_name = '{column_name}'
    );
    """)
    
    with engine.connect() as conn:
        exists = conn.execute(check_column_sql).scalar()
        
        if not exists:
            # Add column if it doesn't exist
            nullable_str = "" if nullable else "NOT NULL"
            
            alter_sql = text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type} {nullable_str};")
            
            print(f"Adding {column_name} to {table_name}...")
            conn.execute(alter_sql)
            
            # Add foreign key if specified
            if foreign_key:
                fk_name = f"fk_{table_name}_{column_name}"
                fk_sql = text(f"""
                ALTER TABLE {table_name} 
                ADD CONSTRAINT {fk_name} FOREIGN KEY ({column_name}) 
                REFERENCES {foreign_key};
                """)
                
                print(f"Adding foreign key constraint {fk_name}...")
                conn.execute(fk_sql)
            
            print(f"Column {column_name} added to {table_name}")
            
            # Commit changes
            conn.commit()
        else:
            print(f"Column {column_name} already exists in {table_name}")

def main():
    """Main function to run migrations"""
    print("Starting database migrations...")
    
    # Add team_id to projects
    alter_table_add_column("projects", "team_id", "INTEGER", nullable=True, foreign_key="teams(id)")
    
    # Add team_id to integrations
    alter_table_add_column("integrations", "team_id", "INTEGER", nullable=True, foreign_key="teams(id)")
    
    print("Database migrations completed!")

if __name__ == "__main__":
    main() 
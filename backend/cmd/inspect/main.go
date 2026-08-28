package main

import (
	"database/sql"
	"fmt"
	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "./haven.db")
	if err != nil {
		panic(err)
	}
	defer db.Close()

	rows, err := db.Query("SELECT id, community_id, name, type FROM channels")
	if err != nil {
		panic(err)
	}
	defer rows.Close()

	for rows.Next() {
		var id, cid, name, ctype string
		rows.Scan(&id, &cid, &name, &ctype)
		fmt.Printf("id=%s cid=%s name=%s type=%s\n", id, cid, name, ctype)
	}
}

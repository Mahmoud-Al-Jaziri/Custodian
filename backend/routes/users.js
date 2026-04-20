import pool from "../db.js";
import { Router } from "express";

const usersRouter = Router();

usersRouter.post('/signup',async(req,res)=>{
    try{
        const {id,display_name} = req.body;
        const query = `
            INSERT INTO users(id,display_name)
            VALUES ($1,$2)
            ON CONFLICT (id) DO NOTHING
        `
        const response = await pool.query(query,[id,display_name]);
        res.status(201).json({message:"user created"})
    }catch(err){
        res.status(500).json({"error":err.message})
    }
})

export default usersRouter;
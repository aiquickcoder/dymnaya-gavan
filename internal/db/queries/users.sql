-- name: CreateUser :one
insert into users (phone_number, gender)
values ($1, $2)
returning *;

-- name: GetUser :one
select * from users
where id = $1;

-- name: GetUserByPhone :one
select * from users
where phone_number = $1;

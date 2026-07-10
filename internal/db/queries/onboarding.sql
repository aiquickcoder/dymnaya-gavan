-- name: CreateBrief :one
-- Store a filled onboarding brief. payload is the full form answers as JSON.
insert into onboarding_briefs (venue, city, contact, phone, payload)
values ($1, $2, $3, $4, $5)
returning *;

-- name: ListBriefs :many
-- Newest briefs first (admin inbox).
select * from onboarding_briefs
order by created_at desc
limit 200;

-- name: GetBrief :one
select * from onboarding_briefs where id = $1;

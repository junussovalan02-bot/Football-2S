class_name Player
extends CharacterBody2D
## Футболист в стиле ретро-аркады (Godot 4.x).
## Конечный автомат: IDLE / RUN / KICK / TACKLE / FALL / STUN.
## Ввод вынесен в PlayerInput: человек и ИИ управляют игроком одинаково —
## ИИ просто заполняет поля `input` каждый кадр, а is_human = false.

enum State { IDLE, RUN, KICK, TACKLE, FALL, STUN }

signal state_changed(from: State, to: State)

class PlayerInput:
	var move := Vector2.ZERO
	var kick_held := false
	var kick_released := false
	var tackle_pressed := false

# ---------- Настройки ----------
@export var team: int = 0
@export var is_human := true
@export var input_prefix := "p1_"          # p1_left, p1_kick, p1_tackle ...

@export_group("Движение")
@export var max_speed := 80.0              # px/s при базовом разрешении 320x180
@export var accel := 800.0

@export_group("Удары")
@export var kick_power := 240.0
@export var kick_lift := 60.0
@export var super_shot: Ball.Super = Ball.Super.FIREBALL
@export var charge_time := 0.6             # держи «удар» — заряжаешь супер-удар

@export_group("Подкат")
@export var tackle_speed := 160.0
@export var tackle_time := 0.45

const KICK_CONTACT := 0.08                 # кадр контакта ноги с мячом
const KICK_TIME := 0.25
const FALL_TIME := 0.9
const STUN_TIME := 1.2
const REACH := 14.0

# ---------- Состояние ----------
var state: State = State.IDLE
var state_time := 0.0
var facing := Vector2.RIGHT
var input := PlayerInput.new()

var speed_mult := 1.0                      # грязь < 1 — игрок вязнет
var traction := 1.0                        # лужа < 1 — инерция, игрок скользит

var _charge := 0.0
var _kick_is_super := false
var _kick_done := false
var _hit_this_tackle := {}

@onready var anim: AnimatedSprite2D = $Anim
@onready var kick_area: Area2D = $KickArea
@onready var ball: Ball = get_tree().get_first_node_in_group("ball")


func _ready() -> void:
	add_to_group("players")


func _physics_process(delta: float) -> void:
	if is_human:
		_poll_human_input()

	state_time += delta
	match state:
		State.IDLE, State.RUN: _state_move(delta)
		State.KICK: _state_kick(delta)
		State.TACKLE: _state_tackle(delta)
		State.FALL: _state_fall(delta)
		State.STUN: _state_stun(delta)

	move_and_slide()
	_update_anim()

	# одноразовые события гасим после обработки
	input.kick_released = false
	input.tackle_pressed = false


# ---------- Ввод ----------
func _poll_human_input() -> void:
	var p := input_prefix
	input.move = _snap8(Input.get_vector(p + "left", p + "right", p + "up", p + "down"))
	input.kick_held = Input.is_action_pressed(p + "kick")
	input.kick_released = Input.is_action_just_released(p + "kick")
	input.tackle_pressed = Input.is_action_just_pressed(p + "tackle")


## Строго 8 направлений, как на крестовине Dendy (стик тоже «щёлкает» по 45°).
static func _snap8(v: Vector2) -> Vector2:
	if v.length() < 0.3:
		return Vector2.ZERO
	return Vector2.from_angle(snappedf(v.angle(), PI / 4.0))


# ---------- Состояния ----------
func _state_move(delta: float) -> void:
	var target := input.move * max_speed * speed_mult
	velocity = velocity.move_toward(target, accel * traction * delta)
	if input.move != Vector2.ZERO:
		facing = input.move
	_change_state(State.RUN if velocity.length() > 4.0 else State.IDLE)

	# дриблинг: мяч «прилипает» к ноге, как в Goal 3
	if _ball_in_reach() and ball.is_on_ground():
		ball.dribble(self, facing, velocity)

	if input.kick_held:
		_charge += delta
	if input.kick_released:
		_kick_is_super = _charge >= charge_time
		_charge = 0.0
		_change_state(State.KICK)
	elif input.tackle_pressed:
		_charge = 0.0
		velocity = facing * tackle_speed
		_change_state(State.TACKLE)


func _state_kick(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, accel * traction * delta)
	if not _kick_done and state_time >= KICK_CONTACT:
		_kick_done = true
		if _ball_in_reach(REACH + 6.0):
			if _kick_is_super:
				ball.kick(facing, kick_power * 1.5, kick_lift, self, super_shot)
			else:
				ball.kick(facing, kick_power, kick_lift, self)
	if state_time >= KICK_TIME:
		_change_state(State.IDLE)


func _state_tackle(delta: float) -> void:
	# на мокром газоне traction < 1 — подкат уезжает дальше
	velocity = velocity.move_toward(Vector2.ZERO, tackle_speed * 1.5 * traction * delta)
	for body in kick_area.get_overlapping_bodies():
		# правил нет: сносим любого, даже своих
		if body is Player and body != self and not _hit_this_tackle.has(body):
			_hit_this_tackle[body] = true
			body.knock_down(facing)
	if _ball_in_reach() and ball.is_on_ground():
		ball.kick(facing, velocity.length() * 1.2 + 40.0, 0.0, self)
	if state_time >= tackle_time:
		_change_state(State.IDLE)


func _state_fall(delta: float) -> void:
	velocity = velocity.move_toward(Vector2.ZERO, 300.0 * traction * delta)
	if state_time >= FALL_TIME:
		_change_state(State.IDLE)


func _state_stun(_delta: float) -> void:
	velocity = Vector2.ZERO
	if state_time >= STUN_TIME:
		_change_state(State.IDLE)


func _change_state(to: State) -> void:
	if to == state:
		return
	var from := state
	state = to
	state_time = 0.0
	match to:
		State.KICK: _kick_done = false
		State.TACKLE: _hit_this_tackle.clear()
	state_changed.emit(from, to)


# ---------- Публичный API (для мяча, погоды, ИИ) ----------
func knock_down(from_dir: Vector2, force := 120.0) -> void:
	if state == State.FALL or state == State.STUN:
		return
	_charge = 0.0
	velocity = from_dir.normalized() * force
	_change_state(State.FALL)


## Молния: скелет на секунду (анимация "shock").
func electrocute() -> void:
	_charge = 0.0
	velocity = Vector2.ZERO
	_change_state(State.STUN)


## Зовут Area2D луж и грязи: body_entered → set_surface(0.6, 0.25), body_exited → set_surface(1, 1).
func set_surface(new_speed_mult: float, new_traction: float) -> void:
	speed_mult = new_speed_mult
	traction = new_traction


# ---------- Вспомогательное ----------
func _ball_in_reach(reach := REACH) -> bool:
	return ball != null and ball.z < 20.0 \
		and global_position.distance_to(ball.global_position) <= reach


func _update_anim() -> void:
	var base: String
	match state:
		State.IDLE: base = "idle"
		State.RUN: base = "run"
		State.KICK: base = "super_kick" if _kick_is_super else "kick"
		State.TACKLE: base = "tackle"
		State.FALL: base = "fall"      # слёзы, звёздочки
		State.STUN: base = "shock"     # скелет от молнии

	# 3 набора спрайтов (side/up/down) + зеркалирование — классика NES
	var dir_name := "side"
	if absf(facing.x) < 0.3:
		dir_name = "up" if facing.y < 0.0 else "down"
	if facing.x != 0.0:
		anim.flip_h = facing.x < 0.0

	var frames := anim.sprite_frames
	if frames == null:
		return
	var anim_name := base + "_" + dir_name
	if not frames.has_animation(anim_name):
		anim_name = base
	if frames.has_animation(anim_name) and anim.animation != anim_name:
		anim.play(anim_name)

	# мигание, когда супер-удар заряжен
	var ready := _charge >= charge_time
	anim.modulate = Color(1.8, 1.4, 0.8) if ready and int(state_time * 20.0) % 2 == 0 else Color.WHITE

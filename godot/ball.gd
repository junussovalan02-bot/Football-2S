class_name Ball
extends CharacterBody2D
## Мяч с псевдо-3D физикой (Godot 4.x).
## position — точка на газоне (по ней работает Y-sort и столкновения),
## z — высота над газоном: спрайт рисуем выше, тень остаётся на земле.
##
## Сцена: Ball (CharacterBody2D, маска коллизий = только штанги/борта)
##   ├ Sprite (Sprite2D или AnimatedSprite2D)
##   ├ Shadow (Sprite2D, необязательно)
##   ├ CollisionShape2D
##   └ Hitbox (Area2D, видит слой игроков)

enum Super { NONE, FIREBALL, VESUVIO, PULCINELLA, GOLFO }

signal super_started(type: Super)
signal super_impact(type: Super, at: Vector2)

@export var gravity := 700.0
@export var ground_friction := 160.0
@export var bounce := 0.45
@export var player_height := 22.0          # выше этого мяч пролетает над головами
@export var decoy_scene: PackedScene       # та же сцена мяча — для «Пульчинеллы»

var z := 0.0
var vz := 0.0
var wind := Vector2.ZERO                   # задаёт система погоды
var ground_drag := 1.0                     # в луже 4.0 — мяч вязнет
var super_type: Super = Super.NONE
var last_kicker: Node2D = null
var is_decoy := false

var _grav_scale := 1.0
var _super_t := 0.0

@onready var sprite: Node2D = $Sprite
@onready var shadow: Node2D = get_node_or_null("Shadow")


func _ready() -> void:
	if not is_decoy:
		add_to_group("ball")
	else:
		get_tree().create_timer(1.4).timeout.connect(queue_free)
	$Hitbox.body_entered.connect(_on_hitbox_body_entered)


func is_on_ground() -> bool:
	return z <= 0.0 and vz <= 0.0


func kick(dir: Vector2, power: float, lift: float, kicker: Node2D, type: Super = Super.NONE) -> void:
	velocity = dir.normalized() * power
	vz = lift
	last_kicker = kicker
	super_type = type
	_super_t = 0.0
	_grav_scale = 1.0
	match type:
		Super.FIREBALL:      # летит почти по прямой, ветер не действует
			vz = 20.0
			_grav_scale = 0.1
		Super.VESUVIO:       # свеча в небо → извержение при падении
			vz = 320.0
			velocity *= 0.65
		Super.PULCINELLA:    # мяч троится, настоящий — один
			if not is_decoy:
				_spawn_decoys(dir, power, lift, kicker)
		Super.GOLFO:         # волна понизу, змейкой
			vz = 0.0
			z = 0.0
	if type != Super.NONE:
		super_started.emit(type)


func dribble(carrier: Node2D, facing: Vector2, carrier_vel: Vector2) -> void:
	if is_decoy or super_type != Super.NONE:
		return
	global_position = global_position.lerp(carrier.global_position + facing * 8.0, 0.3)
	velocity = carrier_vel
	last_kicker = carrier


func _physics_process(delta: float) -> void:
	_super_t += delta

	if z > 0.0 or vz > 0.0:
		vz -= gravity * _grav_scale * delta
		z += vz * delta
		if super_type != Super.FIREBALL:
			velocity += wind * delta
		if z <= 0.0:
			_land()
	else:
		velocity = velocity.move_toward(Vector2.ZERO, ground_friction * ground_drag * delta)
		velocity += wind * 0.25 * delta

	var extra := Vector2.ZERO
	if super_type == Super.GOLFO and velocity != Vector2.ZERO:
		extra = velocity.orthogonal().normalized() * cos(_super_t * 14.0) * 70.0 * delta

	if super_type != Super.NONE and is_on_ground() and velocity.length() < 60.0:
		_end_super()

	var col := move_and_collide(velocity * delta + extra)
	if col:
		velocity = velocity.bounce(col.get_normal()) * 0.6

	_update_visuals()


func _land() -> void:
	z = 0.0
	if super_type == Super.VESUVIO:
		_erupt()
	if vz < -80.0:
		vz = -vz * bounce
		velocity *= 0.85
	else:
		vz = 0.0


func _erupt() -> void:
	for p in get_tree().get_nodes_in_group("players"):
		var d: Vector2 = p.global_position - global_position
		if d.length() < 48.0:
			p.knock_down(d, 200.0)
	super_impact.emit(super_type, global_position)   # тряска камеры, лава-частицы
	_end_super()


func _spawn_decoys(dir: Vector2, power: float, lift: float, kicker: Node2D) -> void:
	if decoy_scene == null:
		return
	for angle in [-0.25, 0.25]:
		var d: Ball = decoy_scene.instantiate()
		d.is_decoy = true
		get_parent().add_child(d)
		d.global_position = global_position
		d.z = z
		d.kick(dir.rotated(angle), power, lift, kicker, Super.PULCINELLA)


func _end_super() -> void:
	super_type = Super.NONE
	_grav_scale = 1.0


func _update_visuals() -> void:
	sprite.position.y = -z
	if shadow:
		var s := clampf(1.0 - z / 150.0, 0.4, 1.0)
		shadow.scale = Vector2(s, s)


func _on_hitbox_body_entered(body: Node2D) -> void:
	if not body is Player or z > player_height:
		return
	if is_decoy:
		if body != last_kicker:
			queue_free()            # фантом лопается в облачке дыма
		return
	if super_type != Super.NONE and body != last_kicker:
		(body as Player).knock_down(velocity, 180.0)   # вратаря сносит вместе с мячом

import Phaser from "phaser";

import Carrot from "../game/Carrot.js";

export default class Game extends Phaser.Scene {
  /** @type {Phaser.Physics.Arcade.StaticGroup} */
  platforms;

  /** @type {Phaser.Physics.Arcade.Sprite} */
  player;

  /** @type {Phaser.Types.Input.Keyboard.CursorKeys} */
  cursors;

  /** @type {Phaser.Physics.Arcade.Group} */
  carrots;

  /** @type {number} */
  carrotsCollected;

  /** @type {Phaser.GameObjects.Text} */
  carrotsCollectedText;

  constructor() {
    super("game");
  }

  init() {
    this.carrotsCollected = 0;
  }

  preload() {
    this.load.image("background", "assets/bg_layer1.png");

    // load the platform image
    this.load.image("platform", "assets/ground_grass.png");

    // load the bunny image
    this.load.image("bunny-stand", "assets/bunny1_stand.png");

    // load the carrot image
    this.load.image("carrot", "assets/carrot.png");

    // load the bunny jump image
    this.load.image("bunny-jump", "assets/bunny1_jump.png");

    // load jump audio
    this.load.audio("jump", "assets/sfx/phaseJump1.ogg");

    // setup cursor keys
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  create() {
    this.add.image(240, 320, "background").setScrollFactor(1, 0);

    // create the group
    this.platforms = this.physics.add.staticGroup();

    // then create 5 platforms for the group
    for (let i = 0; i < 5; ++i) {
      const x = Phaser.Math.Between(80, 400);
      const y = 150 * i;

      /** @type {Phaser.Physics.Arcade.Sprite} */
      const platform = this.platforms.create(x, y, "platform");
      platform.scale = 0.5;

      /** @type {Phaser.Physics.Arcade.StaticBody} */
      const body = platform.body;
      body.updateFromGameObject();
    }

    // create a bunny sprite
    this.player = this.physics.add
      .sprite(240, 320, "bunny-stand")
      .setScale(0.5);

    // add collider between platforms and player
    this.physics.add.collider(this.platforms, this.player);

    // disable all collisions, except down collision
    this.player.body.checkCollision.up = false;
    this.player.body.checkCollision.left = false;
    this.player.body.checkCollision.right = false;

    // follow the player
    this.cameras.main.startFollow(this.player);

    // set the horizontal dead zone to 1.5x game width
    this.cameras.main.setDeadzone(this.scale.width * 1.5);

    // create carrot group
    this.carrots = this.physics.add.group({
      classType: Carrot,
    });

    // add collider between platforms and carrots
    this.physics.add.collider(this.platforms, this.carrots);

    this.physics.add.overlap(
      this.player,
      this.carrots,
      this.handleCollectCarrot,
      undefined,
      this
    );

    const style = {
      color: "#000",
      fontSize: 24,
    };

    this.carrotsCollectedText = this.add
      .text(240, 10, "Carrots: 0", style)
      .setScrollFactor(0)
      .setOrigin(0.5, 0);
  }

  update() {
    this.platforms.children.iterate((child) => {
      /** @type {Phaser.Physics.Arcade.Sprite} */
      const platform = child;

      const scrollY = this.cameras.main.scrollY;
      if (platform.y >= scrollY + 700) {
        platform.y = scrollY - Phaser.Math.Between(50, 100);
        platform.body.updateFromGameObject();

        // create a carrot above the platform being reused
        this.addCarrotAbove(platform);
      }
    });

    // find out from Arcade Physics if the player's physics body
    // is touching something below it
    const touchingDown = this.player.body.touching.down;

    if (touchingDown) {
      // this makes the bunny jump straight up
      this.player.setVelocityY(-350);

      // switch to jump texture
      this.player.setTexture("bunny-jump");

      // play jump sound
      this.sound.play("jump");
    }

    const vy = this.player.body.velocity.y;
    if (vy > 0 && this.player.texture.key !== "bunny-stand") {
      this.player.setTexture("bunny-stand");
    }

    // left and right input logic
    if (this.cursors.left.isDown && !touchingDown) {
      this.player.setVelocityX(-200);
    } else if (this.cursors.right.isDown && !touchingDown) {
      this.player.setVelocityX(200);
    } else {
      this.player.setVelocityX(0);
    }

    // wrap around horizontally
    this.horizontalWrap(this.player);

    // cleanup unpicked carrots
    this.carrots.children.iterate((child) => {
      /** @type {Carrot} */
      const carrot = child;

      const scrollY = this.cameras.main.scrollY;
      if (carrot.y >= scrollY + 700) {
        this.carrots.killAndHide(carrot);
        this.physics.world.disableBody(carrot.body);
      }
    });

    const bottomPlatform = this.findBottomMostPlatform();
    if (this.player.y > bottomPlatform.y + 200) {
      this.scene.start("game-over");
    }
  }

  /**
   *
   * @param {Phaser.GameObjects.Sprite} sprite
   */
  horizontalWrap(sprite) {
    const halfWidth = sprite.displayWidth * 0.5;
    const gameWidth = this.scale.width;

    if (sprite.x < -halfWidth) {
      sprite.x = gameWidth + halfWidth;
    } else if (sprite.x > gameWidth + halfWidth) {
      sprite.x = -halfWidth;
    }
  }

  /**
   *
   * @param {Phaser.GameObjects.Sprite} sprite
   */
  addCarrotAbove(sprite) {
    const y = sprite.y - sprite.displayHeight;

    /** @type {Phaser.Physics.Arcade.Sprite} */
    const carrot = this.carrots.get(sprite.x, y, "carrot");

    // set active and visible
    carrot.setActive(true);
    carrot.setVisible(true);

    this.add.existing(carrot);

    // update the physics body size
    carrot.body.setSize(carrot.width, carrot.height);

    // make sure body is enabled in the physics world
    this.physics.world.enable(carrot);

    return carrot;
  }

  /**
   *
   * @param {Phaser.Physics.Arcade.Sprite} player
   * @param {Carrot} carrot
   */
  handleCollectCarrot(player, carrot) {
    // hide from display
    this.carrots.killAndHide(carrot);

    // disable from physics world
    this.physics.world.disableBody(carrot.body);

    // increment score
    this.carrotsCollected++;

    // create new text value and set it
    const value = `Carrots: ${this.carrotsCollected}`;
    this.carrotsCollectedText.text = value;
  }

  findBottomMostPlatform() {
    const platforms = this.platforms.getChildren();

    /** @type {Phaser.GameObjects.Sprite} */
    let bottomPlatform = platforms[0];

    for (let i = 1; i < platforms.length; i++) {
      /** @type {Phaser.GameObjects.Sprite} */
      const platform = platforms[i];

      // discard any platforms that are above current
      if (platform.y < bottomPlatform.y) {
        continue;
      }

      bottomPlatform = platform;
    }

    return bottomPlatform;
  }
}

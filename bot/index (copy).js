import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  PermissionsBitField,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// Configuration - Set these channel IDs in your Discord server
const CONFIG = {
  APPLICATION_CHANNEL_ID: "1429344583543685221", // Where the embed will be posted
  REVIEW_CHANNEL_ID: "1429344581656510504", // Where admins review applications
  ADMIN_ROLE_ID: "1406295895313485864", // Admin role that can enable/disable applications
  APPLICATION_ENABLED: true, // Toggle for applications
  EMBED_GIF_URL: "https://i.imgur.com/your-image.gif", // Replace with your GIF URL

  // Ticket System Configuration
  TICKET_CATEGORY_ID: "1443961191637450805", // Category where tickets will be created
  TICKET_LOG_CHANNEL_ID: "1443961191637450803", // Channel for ticket logs
  SUPPORT_ROLE_ID: "1443961496039194756", // Role that can view tickets

  // Voice Channel Auto-Create Configuration
  DUO_VC_ID: "1444002192649621626", // The "join to create" voice channel for duos
  TRIO_VC_ID: "1444004553291727023", // The "join to create" voice channel for trios (update this)
  SQUAD_VC_ID: "1444004668933148763", // The "join to create" voice channel for squads (update this)
  VC_CATEGORY_ID: "1443961191637450805", // Category where temporary VCs will be created
};

// Store ticket panels and categories
const ticketPanels = new Map(); // Map of panel message IDs to their categories
const ticketCategories = new Map(); // Map of category names to their configurations
const activeTickets = new Map(); // Map of user IDs to their active ticket channel IDs

// Voice channel management
const tempVoiceChannels = new Map(); // Map of channel IDs to deletion timers
let duoVcCounter = 1; // Counter for naming temporary VCs
let trioVcCounter = 1; // Counter for naming temporary VCs
let squadVcCounter = 1; // Counter for naming temporary VCs

// Initialize default ticket categories
ticketCategories.set("support", {
  name: "Support Desk",
  description:
    "Get assistance from our support team about any issue or inquiry.",
  emoji: "🎫",
  buttonLabel: "Support Desk",
  buttonStyle: ButtonStyle.Primary,
});

ticketCategories.set("rewards", {
  name: "Claim Rewards",
  description: "Redeem your special rewards, event prizes, or giveaways here.",
  emoji: "🎁",
  buttonLabel: "Claim Rewards",
  buttonStyle: ButtonStyle.Success,
});

client.once("ready", () => {
  console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
});

// ============== STAFF APPLICATION COMMANDS ==============

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Command to send the staff application embed
  if (
    message.content === "!setup-staff-app" &&
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    const applicationChannel =
      message.guild.channels.cache.get(CONFIG.APPLICATION_CHANNEL_ID) ||
      message.channel;

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("📝 Staff Applications")
      .setDescription("Want to join our team? Click below to apply!")
      .setImage(CONFIG.EMBED_GIF_URL)
      .setFooter({ text: message.guild.name })
      .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("staff_apply")
        .setLabel("📝 Apply Now")
        .setStyle(ButtonStyle.Primary),
    );

    await applicationChannel.send({
      embeds: [embed],
      components: [button],
    });

    message.reply("✅ Staff application embed has been posted!");
  }

  // Admin command to enable applications
  if (
    message.content === "!enable-applications" &&
    message.member.roles.cache.has(CONFIG.ADMIN_ROLE_ID)
  ) {
    CONFIG.APPLICATION_ENABLED = true;
    message.reply("✅ Staff applications have been **enabled**!");
  }

  // Admin command to disable applications
  if (
    message.content === "!disable-applications" &&
    message.member.roles.cache.has(CONFIG.ADMIN_ROLE_ID)
  ) {
    CONFIG.APPLICATION_ENABLED = false;
    message.reply("❌ Staff applications have been **disabled**!");
  }

  // ============== TICKET SYSTEM COMMANDS ==============

  // Command to create a ticket panel
  if (
    message.content.startsWith("!create-ticket-panel") &&
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    const args = message.content.split(" ").slice(1);
    const title = args.join(" ") || "Thattukada Ticket Center";

    const embed = new EmbedBuilder()
      .setColor("#2b2d31")
      .setTitle(title)
      .setDescription(
        "Need help or want to claim your rewards? You're in the right place!",
      )
      .setImage(CONFIG.EMBED_GIF_URL)
      .setFooter({ text: `${message.guild.name} Support System` })
      .setTimestamp();

    // Add category descriptions to embed (only valid ones)
    let description =
      "Need help or want to claim your rewards? You're in the right place!\n\n";
    const validCategories = new Map();
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u;

    for (const [key, category] of ticketCategories) {
      // Validate emoji before adding
      if (emojiRegex.test(category.emoji)) {
        validCategories.set(key, category);
        description += `${category.emoji} **${category.name}** – ${category.description}\n`;
      } else {
        console.warn(
          `Skipping category "${key}" with invalid emoji: "${category.emoji}"`,
        );
      }
    }
    embed.setDescription(description);

    // Create buttons for each valid category
    const buttons = [];
    let rowIndex = 0;
    const rows = [new ActionRowBuilder()];

    for (const [key, category] of validCategories) {
      if (buttons.length >= 5) {
        rowIndex++;
        rows.push(new ActionRowBuilder());
        buttons.length = 0;
      }

      const button = new ButtonBuilder()
        .setCustomId(`ticket_${key}`)
        .setLabel(category.buttonLabel)
        .setEmoji(category.emoji)
        .setStyle(category.buttonStyle);

      buttons.push(button);
      rows[rowIndex].addComponents(button);
    }

    const sentMessage = await message.channel.send({
      embeds: [embed],
      components: rows,
    });

    // Store panel info
    ticketPanels.set(sentMessage.id, Array.from(ticketCategories.keys()));

    message.reply("✅ Ticket panel created successfully!");
  }

  // Command to add a new ticket category
  if (
    message.content.startsWith("!add-ticket-category") &&
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    const args = message.content.split("|").map((arg) => arg.trim());

    if (args.length < 4) {
      return message.reply(
        "❌ Usage: `!add-ticket-category | category_id | Category Name | Description | emoji`\n" +
          "Example: `!add-ticket-category | bug | Bug Reports | Report bugs and issues | 🐛`",
      );
    }

    const categoryId = args[0].replace("!add-ticket-category", "").trim();
    const categoryName = args[1];
    const description = args[2];
    const emoji = args[3] || "🎫";

    // Validate emoji (basic check for unicode emoji)
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u;
    if (!emojiRegex.test(emoji)) {
      return message.reply(
        `❌ Invalid emoji! Please use a standard Unicode emoji like 🎫, 🐛, 💡, etc.\nYou provided: "${emoji}"`,
      );
    }

    ticketCategories.set(categoryId, {
      name: categoryName,
      description: description,
      emoji: emoji,
      buttonLabel: categoryName,
      buttonStyle: ButtonStyle.Secondary,
    });

    message.reply(
      `✅ Category **${categoryName}** added successfully!\nUse \`!create-ticket-panel\` to create a new panel with this category.`,
    );
  }

  // Command to list all ticket categories
  if (
    message.content === "!list-ticket-categories" &&
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    let categoryList = "**Ticket Categories:**\n\n";

    for (const [key, category] of ticketCategories) {
      categoryList += `${category.emoji} **${key}** - ${category.name}\n${category.description}\n\n`;
    }

    message.reply(categoryList || "No categories configured.");
  }

  // Command to remove a ticket category
  if (
    message.content.startsWith("!remove-ticket-category") &&
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    const categoryId = message.content.split(" ")[1];

    if (!categoryId) {
      return message.reply("❌ Usage: `!remove-ticket-category <category_id>`");
    }

    if (ticketCategories.has(categoryId)) {
      ticketCategories.delete(categoryId);
      message.reply(`✅ Category **${categoryId}** removed successfully!`);
    } else {
      message.reply("❌ Category not found!");
    }
  }

  // Command to clean invalid categories
  if (
    message.content === "!clean-invalid-categories" &&
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u;
    let removed = [];

    for (const [key, category] of ticketCategories) {
      if (!emojiRegex.test(category.emoji)) {
        ticketCategories.delete(key);
        removed.push(`${key} (invalid emoji: "${category.emoji}")`);
      }
    }

    if (removed.length > 0) {
      message.reply(
        `✅ Removed ${removed.length} invalid categories:\n${removed.join("\n")}`,
      );
    } else {
      message.reply("✅ No invalid categories found!");
    }
  }

  // Command to set up voice channel auto-create system
  if (
    message.content === "!setup-auto-vc" &&
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    message.reply(
      "**Voice Channel Auto-Create Setup:**\n\n" +
        "**Configuration:**\n" +
        "1. Update `DUO_VC_ID` in CONFIG with your 'Join to Create Duo' voice channel ID (2 player limit)\n" +
        "2. Update `TRIO_VC_ID` in CONFIG with your 'Join to Create Trio' voice channel ID (3 player limit)\n" +
        "3. Update `SQUAD_VC_ID` in CONFIG with your 'Join to Create Squad' voice channel ID (4 player limit)\n" +
        "4. Update `VC_CATEGORY_ID` in CONFIG with the category where temporary VCs should be created\n" +
        "5. Restart the bot\n\n" +
        "**How it works:**\n" +
        "• When someone joins a trigger VC, a new temporary VC is created\n" +
        "• They are automatically moved to the new channel\n" +
        "• Each type has its own player limit (Duo=2, Trio=3, Squad=4)\n" +
        "• When everyone leaves, the channel is deleted after 20 seconds of inactivity\n" +
        "• If someone joins during the 20-second timer, deletion is cancelled",
    );
  }

  // ============== MODERATION COMMANDS ==============

  // Kick Command
  if (message.content.startsWith("!kick")) {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply("❌ You don't have permission to kick members!");
    }

    const member = message.mentions.members.first();
    const args = message.content.split(" ").slice(2);
    const reason = args.join(" ") || "No reason provided";

    if (!member) {
      return message.reply("❌ Please mention a user to kick!\nUsage: `!kick @user [reason]`");
    }

    if (!member.kickable) {
      return message.reply("❌ I cannot kick this user! They may have higher permissions.");
    }

    try {
      await member.kick(reason);
      
      const kickEmbed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("👢 Member Kicked")
        .addFields(
          { name: "User", value: `${member.user.tag}`, inline: true },
          { name: "Moderator", value: `${message.author.tag}`, inline: true },
          { name: "Reason", value: reason, inline: false }
        )
        .setTimestamp();

      message.reply({ embeds: [kickEmbed] });

      // Try to DM the user
      try {
        await member.user.send(`You have been kicked from **${message.guild.name}**\nReason: ${reason}`);
      } catch (error) {
        console.log("Could not DM user");
      }
    } catch (error) {
      message.reply("❌ Failed to kick the user!");
      console.error(error);
    }
  }

  // Ban Command
  if (message.content.startsWith("!ban")) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply("❌ You don't have permission to ban members!");
    }

    const member = message.mentions.members.first();
    const args = message.content.split(" ").slice(2);
    const reason = args.join(" ") || "No reason provided";

    if (!member) {
      return message.reply("❌ Please mention a user to ban!\nUsage: `!ban @user [reason]`");
    }

    if (!member.bannable) {
      return message.reply("❌ I cannot ban this user! They may have higher permissions.");
    }

    try {
      await member.ban({ reason });
      
      const banEmbed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("🔨 Member Banned")
        .addFields(
          { name: "User", value: `${member.user.tag}`, inline: true },
          { name: "Moderator", value: `${message.author.tag}`, inline: true },
          { name: "Reason", value: reason, inline: false }
        )
        .setTimestamp();

      message.reply({ embeds: [banEmbed] });

      // Try to DM the user
      try {
        await member.user.send(`You have been banned from **${message.guild.name}**\nReason: ${reason}`);
      } catch (error) {
        console.log("Could not DM user");
      }
    } catch (error) {
      message.reply("❌ Failed to ban the user!");
      console.error(error);
    }
  }

  // Timeout Command
  if (message.content.startsWith("!timeout")) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply("❌ You don't have permission to timeout members!");
    }

    const args = message.content.split(" ");
    const member = message.mentions.members.first();
    const duration = args[2]; // e.g., 10m, 1h, 1d
    const reason = args.slice(3).join(" ") || "No reason provided";

    if (!member) {
      return message.reply("❌ Please mention a user to timeout!\nUsage: `!timeout @user <duration> [reason]`\nDuration examples: 10m, 1h, 1d");
    }

    if (!duration) {
      return message.reply("❌ Please specify a duration!\nExamples: 10m, 1h, 1d");
    }

    // Parse duration
    const timeRegex = /^(\d+)([smhd])$/;
    const match = duration.match(timeRegex);
    
    if (!match) {
      return message.reply("❌ Invalid duration format! Use: 10m, 1h, 1d, etc.");
    }

    const timeValue = parseInt(match[1]);
    const timeUnit = match[2];
    let milliseconds;

    switch (timeUnit) {
      case 's': milliseconds = timeValue * 1000; break;
      case 'm': milliseconds = timeValue * 60 * 1000; break;
      case 'h': milliseconds = timeValue * 60 * 60 * 1000; break;
      case 'd': milliseconds = timeValue * 24 * 60 * 60 * 1000; break;
    }

    if (milliseconds > 28 * 24 * 60 * 60 * 1000) {
      return message.reply("❌ Timeout duration cannot exceed 28 days!");
    }

    try {
      await member.timeout(milliseconds, reason);
      
      const timeoutEmbed = new EmbedBuilder()
        .setColor("#F1C40F")
        .setTitle("⏰ Member Timed Out")
        .addFields(
          { name: "User", value: `${member.user.tag}`, inline: true },
          { name: "Duration", value: duration, inline: true },
          { name: "Moderator", value: `${message.author.tag}`, inline: true },
          { name: "Reason", value: reason, inline: false }
        )
        .setTimestamp();

      message.reply({ embeds: [timeoutEmbed] });

      // Try to DM the user
      try {
        await member.user.send(`You have been timed out in **${message.guild.name}** for ${duration}\nReason: ${reason}`);
      } catch (error) {
        console.log("Could not DM user");
      }
    } catch (error) {
      message.reply("❌ Failed to timeout the user!");
      console.error(error);
    }
  }

  // VC Ban Command
  if (message.content.startsWith("!vcban")) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply("❌ You don't have permission to VC ban members!");
    }

    const member = message.mentions.members.first();
    const args = message.content.split(" ").slice(2);
    const reason = args.join(" ") || "No reason provided";

    if (!member) {
      return message.reply("❌ Please mention a user to VC ban!\nUsage: `!vcban @user [reason]`");
    }

    try {
      // Disconnect from voice if connected
      if (member.voice.channel) {
        await member.voice.disconnect();
      }

      // Remove voice channel permissions
      const voiceChannels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice);
      
      for (const [id, channel] of voiceChannels) {
        await channel.permissionOverwrites.create(member.id, {
          Connect: false,
          Speak: false,
        });
      }
      
      const vcBanEmbed = new EmbedBuilder()
        .setColor("#E91E63")
        .setTitle("🔇 Voice Channel Ban")
        .addFields(
          { name: "User", value: `${member.user.tag}`, inline: true },
          { name: "Moderator", value: `${message.author.tag}`, inline: true },
          { name: "Reason", value: reason, inline: false }
        )
        .setFooter({ text: "User cannot join any voice channels" })
        .setTimestamp();

      message.reply({ embeds: [vcBanEmbed] });

      // Try to DM the user
      try {
        await member.user.send(`You have been banned from voice channels in **${message.guild.name}**\nReason: ${reason}`);
      } catch (error) {
        console.log("Could not DM user");
      }
    } catch (error) {
      message.reply("❌ Failed to VC ban the user!");
      console.error(error);
    }
  }

  // Chat Ban Command
  if (message.content.startsWith("!chatban")) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply("❌ You don't have permission to chat ban members!");
    }

    const member = message.mentions.members.first();
    const args = message.content.split(" ").slice(2);
    const reason = args.join(" ") || "No reason provided";

    if (!member) {
      return message.reply("❌ Please mention a user to chat ban!\nUsage: `!chatban @user [reason]`");
    }

    try {
      // Remove text channel permissions
      const textChannels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
      
      for (const [id, channel] of textChannels) {
        await channel.permissionOverwrites.create(member.id, {
          SendMessages: false,
          AddReactions: false,
        });
      }
      
      const chatBanEmbed = new EmbedBuilder()
        .setColor("#E91E63")
        .setTitle("💬 Chat Ban")
        .addFields(
          { name: "User", value: `${member.user.tag}`, inline: true },
          { name: "Moderator", value: `${message.author.tag}`, inline: true },
          { name: "Reason", value: reason, inline: false }
        )
        .setFooter({ text: "User cannot send messages in any channel" })
        .setTimestamp();

      message.reply({ embeds: [chatBanEmbed] });

      // Try to DM the user
      try {
        await member.user.send(`You have been banned from chatting in **${message.guild.name}**\nReason: ${reason}`);
      } catch (error) {
        console.log("Could not DM user");
      }
    } catch (error) {
      message.reply("❌ Failed to chat ban the user!");
      console.error(error);
    }
  }

  // Purge Command
  if (message.content.startsWith("!purge")) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply("❌ You don't have permission to purge messages!");
    }

    const args = message.content.split(" ");
    const amount = parseInt(args[1]);

    if (!amount || amount < 1 || amount > 100) {
      return message.reply("❌ Please specify a number between 1 and 100!\nUsage: `!purge <amount>`");
    }

    try {
      const deleted = await message.channel.bulkDelete(amount + 1, true);
      
      const purgeEmbed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("🗑️ Messages Purged")
        .setDescription(`Successfully deleted **${deleted.size - 1}** messages`)
        .addFields(
          { name: "Moderator", value: `${message.author.tag}`, inline: true },
          { name: "Channel", value: `${message.channel}`, inline: true }
        )
        .setTimestamp();

      const reply = await message.channel.send({ embeds: [purgeEmbed] });
      
      // Delete the confirmation message after 5 seconds
      setTimeout(() => reply.delete().catch(() => {}), 5000);
    } catch (error) {
      message.reply("❌ Failed to purge messages! Messages may be older than 14 days.");
      console.error(error);
    }
  }

  // Unban Command
  if (message.content.startsWith("!unban")) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply("❌ You don't have permission to unban members!");
    }

    const args = message.content.split(" ");
    const userId = args[1];

    if (!userId) {
      return message.reply("❌ Please provide a user ID to unban!\nUsage: `!unban <user_id>`\nYou can get the ID by right-clicking their name in the ban list.");
    }

    try {
      await message.guild.members.unban(userId);
      
      const unbanEmbed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("✅ Member Unbanned")
        .addFields(
          { name: "User ID", value: userId, inline: true },
          { name: "Moderator", value: `${message.author.tag}`, inline: true }
        )
        .setTimestamp();

      message.reply({ embeds: [unbanEmbed] });
    } catch (error) {
      if (error.code === 10026) {
        message.reply("❌ Unknown ban! This user is not banned.");
      } else {
        message.reply("❌ Failed to unban the user! Make sure the user ID is correct.");
        console.error(error);
      }
    }
  }

  // Untimeout Command
  if (message.content.startsWith("!untimeout")) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply("❌ You don't have permission to remove timeouts!");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Please mention a user to remove timeout!\nUsage: `!untimeout @user`");
    }

    if (!member.isCommunicationDisabled()) {
      return message.reply("❌ This user is not timed out!");
    }

    try {
      await member.timeout(null);
      
      const untimeoutEmbed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("✅ Timeout Removed")
        .addFields(
          { name: "User", value: `${member.user.tag}`, inline: true },
          { name: "Moderator", value: `${message.author.tag}`, inline: true }
        )
        .setTimestamp();

      message.reply({ embeds: [untimeoutEmbed] });

      // Try to DM the user
      try {
        await member.user.send(`Your timeout has been removed in **${message.guild.name}**`);
      } catch (error) {
        console.log("Could not DM user");
      }
    } catch (error) {
      message.reply("❌ Failed to remove timeout!");
      console.error(error);
    }
  }

  // Unvcban Command
  if (message.content.startsWith("!unvcban")) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply("❌ You don't have permission to remove VC bans!");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Please mention a user to remove VC ban!\nUsage: `!unvcban @user`");
    }

    try {
      // Remove voice channel permission overrides
      const voiceChannels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice);
      
      for (const [id, channel] of voiceChannels) {
        await channel.permissionOverwrites.delete(member.id);
      }
      
      const unvcbanEmbed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("✅ Voice Channel Ban Removed")
        .addFields(
          { name: "User", value: `${member.user.tag}`, inline: true },
          { name: "Moderator", value: `${message.author.tag}`, inline: true }
        )
        .setFooter({ text: "User can now join voice channels" })
        .setTimestamp();

      message.reply({ embeds: [unvcbanEmbed] });

      // Try to DM the user
      try {
        await member.user.send(`Your voice channel ban has been removed in **${message.guild.name}**`);
      } catch (error) {
        console.log("Could not DM user");
      }
    } catch (error) {
      message.reply("❌ Failed to remove VC ban!");
      console.error(error);
    }
  }

  // Unchatban Command
  if (message.content.startsWith("!unchatban")) {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply("❌ You don't have permission to remove chat bans!");
    }

    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("❌ Please mention a user to remove chat ban!\nUsage: `!unchatban @user`");
    }

    try {
      // Remove text channel permission overrides
      const textChannels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
      
      for (const [id, channel] of textChannels) {
        await channel.permissionOverwrites.delete(member.id);
      }
      
      const unchatbanEmbed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle("✅ Chat Ban Removed")
        .addFields(
          { name: "User", value: `${member.user.tag}`, inline: true },
          { name: "Moderator", value: `${message.author.tag}`, inline: true }
        )
        .setFooter({ text: "User can now send messages in channels" })
        .setTimestamp();

      message.reply({ embeds: [unchatbanEmbed] });

      // Try to DM the user
      try {
        await member.user.send(`Your chat ban has been removed in **${message.guild.name}**`);
      } catch (error) {
        console.log("Could not DM user");
      }
    } catch (error) {
      message.reply("❌ Failed to remove chat ban!");
      console.error(error);
    }
  }

  // Moderation Help
  if (message.content === "!modhelp") {
    const modHelpEmbed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("🛡️ Moderation Commands")
      .setDescription("Available moderation commands for managing your server")
      .addFields(
        {
          name: "!kick @user [reason]",
          value: "Kicks a user from the server",
          inline: false
        },
        {
          name: "!ban @user [reason]",
          value: "Bans a user from the server",
          inline: false
        },
        {
          name: "!unban <user_id>",
          value: "Unbans a user from the server",
          inline: false
        },
        {
          name: "!timeout @user <duration> [reason]",
          value: "Times out a user (e.g., 10m, 1h, 1d)",
          inline: false
        },
        {
          name: "!untimeout @user",
          value: "Removes a timeout from a user",
          inline: false
        },
        {
          name: "!vcban @user [reason]",
          value: "Bans a user from all voice channels",
          inline: false
        },
        {
          name: "!unvcban @user",
          value: "Removes a voice channel ban from a user",
          inline: false
        },
        {
          name: "!chatban @user [reason]",
          value: "Bans a user from chatting in all text channels",
          inline: false
        },
        {
          name: "!unchatban @user",
          value: "Removes a chat ban from a user",
          inline: false
        },
        {
          name: "!purge <amount>",
          value: "Deletes messages (1-100) in the current channel",
          inline: false
        }
      )
      .setFooter({ text: "All commands require appropriate permissions" })
      .setTimestamp();

    message.reply({ embeds: [modHelpEmbed] });
  }

  // Command to edit a ticket panel
  if (
    message.content.startsWith("!edit-ticket-panel") &&
    message.member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    const args = message.content.split(" ");
    const messageId = args[1];

    if (!messageId) {
      return message.reply(
        "❌ Usage: `!edit-ticket-panel <message_id> <new_title>`\nRight-click the panel message and copy ID.",
      );
    }

    const newTitle = args.slice(2).join(" ") || "Thattukada Ticket Center";

    try {
      const panelMessage = await message.channel.messages.fetch(messageId);

      const embed = EmbedBuilder.from(panelMessage.embeds[0]).setTitle(
        newTitle,
      );

      await panelMessage.edit({ embeds: [embed] });
      message.reply("✅ Ticket panel updated successfully!");
    } catch (error) {
      message.reply(
        "❌ Could not find the panel message. Make sure the message ID is correct and in this channel.",
      );
    }
  }

  // Help Command
  if (message.content === "!help") {
    const helpEmbed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("📚 Bot Help Center")
      .setDescription(
        "Select a category from the dropdown menu below to view available commands.",
      )
      .setThumbnail(message.guild.iconURL())
      .addFields({
        name: "📋 Categories",
        value:
          "• Staff Applications\n• Ticket System\n• Moderation\n• Admin Tools\n• General Info",
        inline: false,
      })
      .setFooter({ text: `Requested by ${message.author.tag}` })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("help_menu")
      .setPlaceholder("📂 Select a command category")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Staff Applications")
          .setDescription("Commands related to staff applications")
          .setValue("help_applications")
          .setEmoji("📝"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Ticket System")
          .setDescription("Ticket management commands")
          .setValue("help_tickets")
          .setEmoji("🎫"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Moderation")
          .setDescription("Moderation and punishment commands")
          .setValue("help_moderation")
          .setEmoji("🛡️"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Admin Tools")
          .setDescription("Administrative commands")
          .setValue("help_admin")
          .setEmoji("🛠️"),
        new StringSelectMenuOptionBuilder()
          .setLabel("General Info")
          .setDescription("Bot information and support")
          .setValue("help_general")
          .setEmoji("ℹ️"),
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await message.reply({
      embeds: [helpEmbed],
      components: [row],
    });
  }
});

// ============== SELECT MENU INTERACTIONS ==============

client.on("interactionCreate", async (interaction) => {
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "help_menu") {
      const selectedValue = interaction.values[0];
      let helpEmbed;

      switch (selectedValue) {
        case "help_applications":
          helpEmbed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("📝 Staff Application Commands")
            .setDescription("Commands for managing staff applications")
            .addFields(
              {
                name: "!setup-staff-app",
                value:
                  "Posts the staff application embed with apply button\n**Permissions:** Administrator",
                inline: false,
              },
              {
                name: "!enable-applications",
                value:
                  "Enables staff applications\n**Permissions:** Admin Role",
                inline: false,
              },
              {
                name: "!disable-applications",
                value:
                  "Disables staff applications\n**Permissions:** Admin Role",
                inline: false,
              },
            )
            .setFooter({ text: "Use the dropdown to view other categories" })
            .setTimestamp();
          break;

        case "help_tickets":
          helpEmbed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("🎫 Ticket System Commands")
            .setDescription("Commands for managing the ticket system")
            .addFields(
              {
                name: "!create-ticket-panel [title]",
                value:
                  "Creates a ticket panel with buttons\n**Example:** `!create-ticket-panel Support Center`\n**Permissions:** Administrator",
                inline: false,
              },
              {
                name: "!edit-ticket-panel <message_id> <new_title>",
                value:
                  "Edits an existing ticket panel's title\n**Example:** `!edit-ticket-panel 1234567890 New Title`\n**Permissions:** Administrator",
                inline: false,
              },
              {
                name: "!add-ticket-category",
                value:
                  "Adds a new ticket category\n**Format:** `!add-ticket-category | id | Name | Description | emoji`\n**Example:** `!add-ticket-category | bug | Bug Reports | Report bugs | 🐛`\n**Permissions:** Administrator",
                inline: false,
              },
              {
                name: "!list-ticket-categories",
                value:
                  "Lists all configured ticket categories\n**Permissions:** Administrator",
                inline: false,
              },
              {
                name: "!remove-ticket-category <category_id>",
                value:
                  "Removes a ticket category\n**Example:** `!remove-ticket-category bug`\n**Permissions:** Administrator",
                inline: false,
              },
            )
            .setFooter({ text: "Use the dropdown to view other categories" })
            .setTimestamp();
          break;

        case "help_moderation":
          helpEmbed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("🛡️ Moderation Commands")
            .setDescription("Commands for moderating your server")
            .addFields(
              {
                name: "!kick @user [reason]",
                value: "Kicks a user from the server\n**Permissions:** Kick Members",
                inline: false,
              },
              {
                name: "!ban @user [reason]",
                value: "Bans a user from the server\n**Permissions:** Ban Members",
                inline: false,
              },
              {
                name: "!unban <user_id>",
                value: "Unbans a user from the server\n**Permissions:** Ban Members",
                inline: false,
              },
              {
                name: "!timeout @user <duration> [reason]",
                value: "Times out a user (max 28 days)\n**Example:** `!timeout @user 1h Spamming`\n**Durations:** s=seconds, m=minutes, h=hours, d=days\n**Permissions:** Moderate Members",
                inline: false,
              },
              {
                name: "!untimeout @user",
                value: "Removes a timeout from a user\n**Permissions:** Moderate Members",
                inline: false,
              },
              {
                name: "!vcban @user [reason]",
                value: "Bans a user from all voice channels\n**Permissions:** Moderate Members",
                inline: false,
              },
              {
                name: "!unvcban @user",
                value: "Removes a voice channel ban from a user\n**Permissions:** Moderate Members",
                inline: false,
              },
              {
                name: "!chatban @user [reason]",
                value: "Bans a user from all text channels\n**Permissions:** Moderate Members",
                inline: false,
              },
              {
                name: "!unchatban @user",
                value: "Removes a chat ban from a user\n**Permissions:** Moderate Members",
                inline: false,
              },
              {
                name: "!purge <amount>",
                value: "Deletes 1-100 messages in current channel\n**Note:** Cannot delete messages older than 14 days\n**Permissions:** Manage Messages",
                inline: false,
              },
              {
                name: "!modhelp",
                value: "Shows moderation commands quick reference",
                inline: false,
              },
            )
            .setFooter({ text: "Use the dropdown to view other categories" })
            .setTimestamp();
          break;

        case "help_admin":
          helpEmbed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("🛠️ Admin Tools")
            .setDescription("Administrative commands and tools")
            .addFields(
              {
                name: "📋 Configuration Requirements",
                value:
                  "Update these IDs in the CONFIG object:\n• `APPLICATION_CHANNEL_ID`\n• `REVIEW_CHANNEL_ID`\n• `ADMIN_ROLE_ID`\n• `TICKET_CATEGORY_ID`\n• `TICKET_LOG_CHANNEL_ID`\n• `SUPPORT_ROLE_ID`",
                inline: false,
              },
              {
                name: "🔘 Interactive Buttons",
                value:
                  "• **Apply Now** - Opens application modal\n• **Support Desk / Claim Rewards** - Opens tickets\n• **Close Ticket** - Closes current ticket\n• **Claim** - Claims ticket for support staff\n• **Approve/Deny** - Reviews applications",
                inline: false,
              },
            )
            .setFooter({ text: "Use the dropdown to view other categories" })
            .setTimestamp();
          break;

        case "help_general":
          helpEmbed = new EmbedBuilder()
            .setColor("#5865F2")
            .setTitle("ℹ️ General Information")
            .setDescription("Bot information and features")
            .addFields(
              {
                name: "🤖 About",
                value:
                  "This bot provides staff application management and a comprehensive ticket system for your server.",
                inline: false,
              },
              {
                name: "✨ Features",
                value:
                  "• Staff Application System\n• Multi-Category Ticket System\n• Button-Based Interface\n• Admin Controls\n• Ticket Logging",
                inline: false,
              },
              {
                name: "🆘 Support",
                value: "Open a ticket using the ticket panel for support!",
                inline: false,
              },
              {
                name: "📝 Quick Start",
                value:
                  "1. Configure IDs in CONFIG object\n2. Run `!setup-staff-app` for applications\n3. Run `!create-ticket-panel` for tickets\n4. Use `!help` to view this menu anytime",
                inline: false,
              },
            )
            .setFooter({ text: "Use the dropdown to view other categories" })
            .setTimestamp();
          break;

        default:
          return;
      }

      await interaction.update({
        embeds: [helpEmbed],
      });
    }
  }
});

// ============== BUTTON INTERACTIONS ==============

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // Staff Application Button
  if (interaction.customId === "staff_apply") {
    if (!CONFIG.APPLICATION_ENABLED) {
      return interaction.reply({
        content:
          "❌ **Staff applications are currently closed!**\nPlease check back later.",
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("staff_application_modal")
      .setTitle("Staff Application");

    const nameInput = new TextInputBuilder()
      .setCustomId("app_name")
      .setLabel("What is your name?")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const ageInput = new TextInputBuilder()
      .setCustomId("app_age")
      .setLabel("How old are you?")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(3);

    const experienceInput = new TextInputBuilder()
      .setCustomId("app_experience")
      .setLabel("Do you have any moderation experience?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);

    const reasonInput = new TextInputBuilder()
      .setCustomId("app_reason")
      .setLabel("Why do you want to join our staff team?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const availabilityInput = new TextInputBuilder()
      .setCustomId("app_availability")
      .setLabel("How many hours can you dedicate per week?")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const row1 = new ActionRowBuilder().addComponents(nameInput);
    const row2 = new ActionRowBuilder().addComponents(ageInput);
    const row3 = new ActionRowBuilder().addComponents(experienceInput);
    const row4 = new ActionRowBuilder().addComponents(reasonInput);
    const row5 = new ActionRowBuilder().addComponents(availabilityInput);

    modal.addComponents(row1, row2, row3, row4, row5);

    await interaction.showModal(modal);
  }

  // Close Ticket Button (must be checked before generic ticket_ handler)
  if (interaction.customId === "ticket_close") {
    try {
      const ticketEmbed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle("🔒 Close Ticket")
        .setDescription(
          "Are you sure you want to close this ticket?\nThis action cannot be undone.",
        )
        .setTimestamp();

      const confirmButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close_confirm")
          .setLabel("Confirm Close")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("ticket_close_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.reply({
        embeds: [ticketEmbed],
        components: [confirmButtons],
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error showing close confirmation:", error);
      await interaction
        .reply({
          content: "❌ An error occurred. Please try again.",
          ephemeral: true,
        })
        .catch(() => {});
    }
    return;
  }

  // Claim Ticket Button (must be checked before generic ticket_ handler)
  if (interaction.customId === "ticket_claim") {
    try {
      // Check if user has support role or is admin
      const hasPermission =
        interaction.member.roles.cache.has(CONFIG.SUPPORT_ROLE_ID) ||
        interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!hasPermission) {
        return interaction.reply({
          content: "❌ You do not have permission to claim tickets!",
          ephemeral: true,
        });
      }

      const claimEmbed = new EmbedBuilder()
        .setColor("#57F287")
        .setDescription(
          `✋ This ticket has been claimed by ${interaction.user}`,
        )
        .setTimestamp();

      await interaction.reply({ embeds: [claimEmbed] });

      // Update the ticket message to show it's claimed
      const ticketMessage = interaction.channel.messages.cache.find(
        (msg) => msg.author.id === client.user.id && msg.embeds.length > 0,
      );

      if (ticketMessage) {
        const updatedEmbed = EmbedBuilder.from(
          ticketMessage.embeds[0],
        ).addFields({
          name: "✋ Claimed By",
          value: interaction.user.tag,
          inline: true,
        });

        await ticketMessage.edit({ embeds: [updatedEmbed] });
      }
    } catch (error) {
      console.error("Error claiming ticket:", error);
      await interaction
        .reply({
          content: "❌ An error occurred while claiming the ticket.",
          ephemeral: true,
        })
        .catch(() => {});
    }
    return;
  }

  // Ticket System Buttons (creation only - must be checked AFTER specific actions)
  if (
    interaction.customId.startsWith("ticket_") &&
    interaction.customId !== "ticket_close" &&
    interaction.customId !== "ticket_claim" &&
    interaction.customId !== "ticket_close_confirm" &&
    interaction.customId !== "ticket_close_cancel"
  ) {
    const categoryId = interaction.customId.replace("ticket_", "");
    const category = ticketCategories.get(categoryId);

    if (!category) {
      return interaction
        .reply({
          content: "❌ This ticket category no longer exists!",
          ephemeral: true,
        })
        .catch((err) => {
          console.error("Failed to reply to interaction:", err.message);
        });
    }

    // Check if user already has an active ticket
    if (activeTickets.has(interaction.user.id)) {
      const existingTicketId = activeTickets.get(interaction.user.id);
      return interaction
        .reply({
          content: `❌ You already have an active ticket! <#${existingTicketId}>`,
          ephemeral: true,
        })
        .catch((err) => {
          console.error("Failed to reply to interaction:", err.message);
        });
    }

    // Validate configuration BEFORE deferring
    if (!CONFIG.TICKET_CATEGORY_ID) {
      return interaction.reply({
        content:
          "❌ Ticket system not configured! Admin needs to set TICKET_CATEGORY_ID in the CONFIG.",
        ephemeral: true,
      });
    }

    // Verify category exists BEFORE deferring
    const ticketCategory = interaction.guild.channels.cache.get(
      CONFIG.TICKET_CATEGORY_ID,
    );
    if (!ticketCategory || ticketCategory.type !== ChannelType.GuildCategory) {
      return interaction.reply({
        content:
          "❌ Invalid ticket category! Admin needs to verify TICKET_CATEGORY_ID in the CONFIG.",
        ephemeral: true,
      });
    }

    // Verify bot has permissions BEFORE deferring
    const botMember = interaction.guild.members.cache.get(client.user.id);
    const requiredPermissions = [
      PermissionsBitField.Flags.ManageChannels,
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
    ];

    const missingPermissions = requiredPermissions.filter(
      (perm) => !botMember.permissionsIn(ticketCategory).has(perm),
    );

    if (missingPermissions.length > 0) {
      return interaction.reply({
        content:
          '❌ Bot is missing permissions! Contact an admin to grant "Manage Channels" permission in the ticket category.',
        ephemeral: true,
      });
    }

    // Only defer AFTER all validation passes
    await interaction.deferReply({ ephemeral: true });

    try {
      // Create ticket channel
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-"),
        type: ChannelType.GuildText,
        parent: CONFIG.TICKET_CATEGORY_ID,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
            ],
          },
          {
            id: CONFIG.SUPPORT_ROLE_ID,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
            ],
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.ManageChannels,
            ],
          },
        ],
      });

      activeTickets.set(interaction.user.id, ticketChannel.id);

      // Create ticket embed
      const ticketEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle(`${category.emoji} ${category.name}`)
        .setDescription(
          `Welcome ${interaction.user}!\n\nOur support team will be with you shortly. Please describe your issue or request in detail.`,
        )
        .addFields(
          { name: "📋 Category", value: category.name, inline: true },
          { name: "👤 Opened By", value: interaction.user.tag, inline: true },
          {
            name: "🕐 Opened At",
            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
            inline: false,
          },
        )
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: "Use the buttons below to manage this ticket" })
        .setTimestamp();

      const ticketButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("Close Ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("ticket_claim")
          .setLabel("Claim")
          .setEmoji("✋")
          .setStyle(ButtonStyle.Primary),
      );

      await ticketChannel.send({
        content: `${interaction.user} | <@&${CONFIG.SUPPORT_ROLE_ID}>`,
        embeds: [ticketEmbed],
        components: [ticketButtons],
      });

      await interaction.editReply({
        content: `✅ Ticket created! ${ticketChannel}`,
      });

      // Log ticket creation
      const logChannel = interaction.guild.channels.cache.get(
        CONFIG.TICKET_LOG_CHANNEL_ID,
      );
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor("#57F287")
          .setTitle("🎫 Ticket Opened")
          .addFields(
            {
              name: "User",
              value: `${interaction.user.tag} (${interaction.user.id})`,
              inline: true,
            },
            { name: "Category", value: category.name, inline: true },
            { name: "Channel", value: `${ticketChannel}`, inline: false },
          )
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
      console.error("Error details:", error.message);
      await interaction.editReply({
        content: `❌ Failed to create ticket. Error: ${error.message}\n\nPlease ensure:\n• Bot has "Manage Channels" permission\n• TICKET_CATEGORY_ID is correctly set\n• The category exists and bot can access it`,
      });
    }
  }

  // Confirm Close Ticket
  if (interaction.customId === "ticket_close_confirm") {
    try {
      const channel = interaction.channel;

      // Find the user who opened this ticket
      let ticketOwnerId = null;
      for (const [userId, channelId] of activeTickets) {
        if (channelId === channel.id) {
          ticketOwnerId = userId;
          break;
        }
      }

      // Remove from active tickets
      if (ticketOwnerId) {
        activeTickets.delete(ticketOwnerId);
      }

      // Log ticket closure
      const logChannel = interaction.guild.channels.cache.get(
        CONFIG.TICKET_LOG_CHANNEL_ID,
      );
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setColor("#ED4245")
          .setTitle("🔒 Ticket Closed")
          .addFields(
            { name: "Channel", value: channel.name, inline: true },
            {
              name: "Closed By",
              value: `${interaction.user.tag}`,
              inline: true,
            },
            {
              name: "Closed At",
              value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
              inline: false,
            },
          )
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }

      // Update the confirmation message
      await interaction.update({
        content: "🔒 This ticket will be deleted in 5 seconds...",
        embeds: [],
        components: [],
      });

      setTimeout(async () => {
        try {
          await channel.delete();
        } catch (error) {
          console.error("Error deleting ticket channel:", error);
        }
      }, 5000);
    } catch (error) {
      console.error("Error closing ticket:", error);
      await interaction
        .reply({
          content: "❌ An error occurred while closing the ticket.",
          ephemeral: true,
        })
        .catch(() => {});
    }
  }

  // Cancel Close Ticket
  if (interaction.customId === "ticket_close_cancel") {
    try {
      await interaction.update({
        content: "✅ Ticket closure cancelled.",
        embeds: [],
        components: [],
      });
    } catch (error) {
      console.error("Error cancelling close:", error);
    }
  }

  // Application Review Buttons
  if (
    interaction.customId.startsWith("approve_") ||
    interaction.customId.startsWith("deny_")
  ) {
    if (!interaction.member.roles.cache.has(CONFIG.ADMIN_ROLE_ID)) {
      return interaction.reply({
        content: "❌ You do not have permission to review applications!",
        ephemeral: true,
      });
    }

    const userId = interaction.customId.split("_")[1];
    const action = interaction.customId.startsWith("approve_")
      ? "approved"
      : "denied";

    await interaction.message.edit({
      components: [],
    });

    const statusEmbed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(action === "approved" ? "#57F287" : "#ED4245")
      .addFields({
        name: "📋 Status",
        value: `**${action.toUpperCase()}** by ${interaction.user.tag}`,
        inline: false,
      });

    await interaction.message.edit({ embeds: [statusEmbed] });

    try {
      const applicant = await client.users.fetch(userId);
      const dmEmbed = new EmbedBuilder()
        .setColor(action === "approved" ? "#57F287" : "#ED4245")
        .setTitle(
          `Staff Application ${action === "approved" ? "Approved ✅" : "Denied ❌"}`,
        )
        .setDescription(
          action === "approved"
            ? `Congratulations! Your staff application has been approved. A staff member will contact you soon.`
            : `Thank you for applying. Unfortunately, your staff application has been denied at this time. You may reapply in the future.`,
        )
        .setTimestamp();

      await applicant.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.error("Could not DM applicant:", error);
    }

    interaction.reply({
      content: `✅ Application has been **${action}**!`,
      ephemeral: true,
    });
  }
});

// ============== MODAL SUBMISSIONS ==============

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === "staff_application_modal") {
    const name = interaction.fields.getTextInputValue("app_name");
    const age = interaction.fields.getTextInputValue("app_age");
    const experience = interaction.fields.getTextInputValue("app_experience");
    const reason = interaction.fields.getTextInputValue("app_reason");
    const availability =
      interaction.fields.getTextInputValue("app_availability");

    const reviewChannel = interaction.guild.channels.cache.get(
      CONFIG.REVIEW_CHANNEL_ID,
    );

    if (!reviewChannel) {
      return interaction.reply({
        content:
          "❌ Review channel not found! Please contact an administrator.",
        ephemeral: true,
      });
    }

    const reviewEmbed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("📝 New Staff Application")
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: "👤 Applicant",
          value: `${interaction.user.tag}\n${interaction.user}`,
          inline: true,
        },
        { name: "🆔 User ID", value: interaction.user.id, inline: true },
        { name: "\u200b", value: "\u200b", inline: true },
        { name: "📛 Name", value: name, inline: false },
        { name: "🎂 Age", value: age, inline: true },
        { name: "⏰ Availability", value: availability, inline: true },
        { name: "\u200b", value: "\u200b", inline: true },
        { name: "💼 Moderation Experience", value: experience, inline: false },
        { name: "💭 Why Join Our Team?", value: reason, inline: false },
      )
      .setFooter({ text: `Applied on ${new Date().toLocaleDateString()}` })
      .setTimestamp();

    const reviewButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_${interaction.user.id}`)
        .setLabel("✅ Approve")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`deny_${interaction.user.id}`)
        .setLabel("❌ Deny")
        .setStyle(ButtonStyle.Danger),
    );

    await reviewChannel.send({
      embeds: [reviewEmbed],
      components: [reviewButtons],
    });

    await interaction.reply({
      content:
        "✅ **Your application has been submitted successfully!**\nOur staff team will review it shortly.",
      ephemeral: true,
    });
  }
});

// ============== VOICE CHANNEL AUTO-CREATE SYSTEM ==============

client.on("voiceStateUpdate", async (oldState, newState) => {
  // Handle when someone joins a trigger channel
  if (newState.channelId && newState.channelId !== oldState.channelId) {
    let vcType = null;
    let limit = 0;
    let counter = 0;

    // Determine which type of VC was joined
    if (newState.channelId === CONFIG.DUO_VC_ID) {
      vcType = "Duo VC";
      limit = 2;
      counter = duoVcCounter++;
    } else if (newState.channelId === CONFIG.TRIO_VC_ID) {
      vcType = "Trio VC";
      limit = 3;
      counter = trioVcCounter++;
    } else if (newState.channelId === CONFIG.SQUAD_VC_ID) {
      vcType = "Squad VC";
      limit = 4;
      counter = squadVcCounter++;
    }

    // If a trigger channel was joined, create a new temporary VC
    if (vcType) {
      try {
        // Create a new temporary voice channel
        const tempChannel = await newState.guild.channels.create({
          name: `${vcType} ${counter}`,
          type: ChannelType.GuildVoice,
          parent: CONFIG.VC_CATEGORY_ID,
          userLimit: limit,
          permissionOverwrites: [
            {
              id: newState.guild.id,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.Connect,
                PermissionsBitField.Flags.Speak,
              ],
            },
          ],
        });

        // Move the user to the new channel
        await newState.member.voice.setChannel(tempChannel);

        // Track this temporary channel
        tempVoiceChannels.set(tempChannel.id, null);

        console.log(
          `✅ Created temporary VC: ${tempChannel.name} for ${newState.member.user.tag}`,
        );
      } catch (error) {
        console.error("Error creating temporary voice channel:", error);
      }
    }
  }

  // Check if a temporary voice channel became empty
  if (oldState.channel && tempVoiceChannels.has(oldState.channelId)) {
    const channel = oldState.channel;

    // Check if channel is now empty
    if (channel.members.size === 0) {
      // Clear any existing timer for this channel
      const existingTimer = tempVoiceChannels.get(channel.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set a 20-second deletion timer
      const deletionTimer = setTimeout(async () => {
        try {
          // Double-check the channel is still empty before deleting
          const currentChannel = await oldState.guild.channels.fetch(
            channel.id,
          );
          if (currentChannel && currentChannel.members.size === 0) {
            await currentChannel.delete();
            tempVoiceChannels.delete(channel.id);
            console.log(`🗑️ Deleted empty temporary VC: ${channel.name}`);
          }
        } catch (error) {
          console.error("Error deleting temporary voice channel:", error);
          tempVoiceChannels.delete(channel.id);
        }
      }, 20000); // 20 seconds

      tempVoiceChannels.set(channel.id, deletionTimer);
      console.log(`⏳ Started 20-second deletion timer for: ${channel.name}`);
    }
  }

  // If someone joins a temporary channel that has a deletion timer, cancel it
  if (newState.channel && tempVoiceChannels.has(newState.channelId)) {
    const existingTimer = tempVoiceChannels.get(newState.channelId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      tempVoiceChannels.set(newState.channelId, null);
      console.log(`✅ Cancelled deletion timer for: ${newState.channel.name}`);
    }
  }
});

client.login(
  "MTQ0Mzk2Mjk1NjE1NjEwOTAzNA.G834BC.IsJjPAoMO2SzockL-ahD8DS1rMtpRqdJJCGEzc",
);
